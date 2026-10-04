import { z } from 'zod'
import { capabilityRegistry, runCapability, type Capability, type CapabilityRunContext } from './registry'
import { routeGoal, planForGoal } from '../agentic/planner'
import { createEventEmitter, type AgentStreamEmitter } from '../agent/agent-events'
import { withAiCallContext } from '../agent/telemetry'
import { agentRunService } from '../services/agent-run.service'
import '../flue/skills'

/**
 * T05 first capability: `goal.plan`. Understands a business-owner goal and
 * plans it: deterministic keyword routing first (zero model calls for routed
 * goals); schema-validated model planning only for unrouted ones.
 *
 * The planner routing table survives as pre-delegation routing (PRD locked
 * decision 3); this capability owns the run path. The legacy goal service is
 * retained only for persisted goal-run compatibility endpoints.
 */

const GoalInputSchema = z.object({
  goal: z.string().trim().min(1).max(2000),
})

const GoalOutputSchema = z.object({
  goal: z.string(),
  routed: z.boolean(),
  /** Step ids + labels the plan will run (drives the chat step rail, T23). */
  steps: z.array(z.object({ id: z.string(), label: z.string() })),
  summary: z.string(),
})

async function runGoal(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = GoalInputSchema.parse(rawInput)
  const routed = routeGoal(input.goal)
  if (routed) {
    const steps = routed.steps.map(step => ({ id: step.id, label: step.title }))
    return {
      success: true as const,
      data: { goal: input.goal, routed: true, steps, summary: routed.summary },
    }
  }
  const planned = await planForGoal({
    goal: input.goal,
    complete: ctx.complete,
    systemContext: ctx.systemContext,
  })
  if (!planned.success) return { success: false as const, error: planned.error, code: planned.code }
  return {
    success: true as const,
    data: {
      goal: input.goal,
      routed: false,
      steps: planned.data.steps.map(step => ({ id: step.id, label: step.title })),
      summary: planned.data.summary,
    },
  }
}

const goalPlanCapability: Capability<{ goal: string }, { goal: string, routed: boolean, steps: Array<{ id: string, label: string }>, summary: string }> = {
  id: 'goal.plan',
  title: 'Plan your goal',
  description: 'Turn a business goal into a clear, bounded plan with the next step to take.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runGoal(input, ctx),
  inputSchema: GoalInputSchema,
  outputSchema: GoalOutputSchema,
  consequential: false,
  stream: 'sse',
  render: 'plan',
}

export function registerBuiltinCapabilities(): void {
  if (!capabilityRegistry.has(goalPlanCapability.id)) capabilityRegistry.register(goalPlanCapability)
  if (!capabilityRegistry.has(goalExecuteCapability.id)) capabilityRegistry.register(goalExecuteCapability)
}

export { runCapability, capabilityRegistry }

/**
 * T05 second capability: `goal.execute`. The first complete goal executable
 * end-to-end through `runCapability`:
 *
 * deterministic routing (zero model calls for routed goals) → schema-validated
 * model planning only for unrouted ones → plain-language reply → `agent_runs`
 * telemetry (start/finish, duration) → stable SSE events over the existing
 * chat contract plus the additive run/step envelope. Flue delegation to
 * specialists remains the focused execution path for vertical slices.
 */

const GoalExecuteInputSchema = z.object({
  goal: z.string().trim().min(1).max(2000),
})

const GoalExecuteStepSchema = z.object({ id: z.string(), label: z.string() })

const GoalExecuteOutputSchema = z.object({
  goalRunId: z.string(),
  goal: z.string(),
  routed: z.boolean(),
  steps: z.array(GoalExecuteStepSchema),
  summary: z.string(),
  reply: z.string(),
})

type GoalExecuteSteps = Array<{ id: string, label: string }>

function runStepEvents(runId: string, emit: AgentStreamEmitter, steps: GoalExecuteSteps): Promise<void[]> {
  return Promise.all(steps.map(step => emit({
    type: 'step.completed',
    runId,
    stepId: step.id,
    status: 'done',
    summary: step.label,
  })))
}

/** Plain-language reply: numbered steps plus one clear next step. */
function buildGoalReply(steps: GoalExecuteSteps, summary: string): string {
  const lines = steps.map((step, index) => `${index + 1}. ${step.label}`)
  const next = steps[0] ? `\n\nI think you should start with #1.` : ''
  const intro = summary === '' ? 'Here is your plan.' : summary
  return `${intro}\n\n${lines.join('\n')}${next}`
}

function toRailSteps(steps: Array<{ id: string, title: string }>): GoalExecuteSteps {
  return steps.map(step => ({ id: step.id, label: step.title }))
}

interface ExecutePlan {
  routed: boolean
  steps: GoalExecuteSteps
  summary: string
}

async function runGoalExecute(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = GoalExecuteInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Goal is required', code: 'VALIDATION_ERROR' }
  }
  const startedAt = Date.now()
  const runRow = await agentRunService.start(ctx.userId, {
    businessId: ctx.businessId === '' ? null : ctx.businessId,
    agentName: 'MagicSyncAgent',
  })
  if (!runRow.success) return { success: false as const, error: runRow.error, code: runRow.code ?? 'RUN_START_FAILED' }
  const runId = runRow.data.id
  const emit = createEventEmitter(runId, event => ctx.onEvent?.(event))
  await emit({ type: 'message.started', sessionId: runId })

  // Correlate every model call of this run (T19: AsyncLocalStorage).
  return withAiCallContext({
    runId,
    capability: 'goal.execute',
    agent: 'MagicSyncAgent',
    userId: ctx.userId,
    businessId: ctx.businessId === '' ? undefined : ctx.businessId,
  }, () => continueGoalExecute(parsed.data.goal, ctx, runId, emit, startedAt))
}

async function continueGoalExecute(
  goal: string,
  ctx: CapabilityRunContext,
  runId: string,
  emit: AgentStreamEmitter,
  startedAt: number,
) {
  const routed = routeGoal(goal)
  if (routed) {
    const plan: ExecutePlan = { routed: true, steps: toRailSteps(routed.steps), summary: routed.summary }
    return finishGoalExecute(runId, emit, { ...plan, goal }, startedAt)
  }
  const planned = await planForGoal({
    goal,
    complete: ctx.complete,
    systemContext: ctx.systemContext,
  })
  if (!planned.success) {
    await agentRunService.finish(runId, { status: 'failed', durationMs: Date.now() - startedAt, summary: planned.error })
    await emit({ type: 'error', code: planned.code ?? 'GOAL_UNPLANABLE', message: planned.error })
    return { success: false as const, error: planned.error, code: planned.code }
  }
  const plan: ExecutePlan = { routed: false, steps: toRailSteps(planned.data.steps), summary: planned.data.summary }
  return finishGoalExecute(runId, emit, { ...plan, goal }, startedAt)
}

async function finishGoalExecute(
  runId: string,
  emit: AgentStreamEmitter,
  plan: ExecutePlan & { goal: string },
  startedAt: number,
) {
  const reply = buildGoalReply(plan.steps, plan.summary)
  await emit({
    type: 'run.started',
    runId,
    capability: 'goal.execute',
    title: 'Your plan',
    steps: plan.steps,
  })
  await emit({ type: 'text.delta', delta: reply })
  await runStepEvents(runId, emit, plan.steps)
  await emit({ type: 'message.completed', sessionId: runId, threadId: runId, content: reply })
  await emit({ type: 'run.completed', runId, result: { goal: plan.goal, steps: plan.steps } })
  await agentRunService.finish(runId, {
    status: 'completed',
    tokensUsed: 0,
    durationMs: Date.now() - startedAt,
    toolEvents: [],
    summary: reply.slice(0, 500),
  })
  return {
    success: true as const,
    data: { goalRunId: runId, goal: plan.goal, routed: plan.routed, steps: plan.steps, summary: plan.summary, reply },
  }
}

const goalExecuteCapability: Capability<{ goal: string }, { goalRunId: string, goal: string, routed: boolean, steps: GoalExecuteSteps, summary: string, reply: string }> = {
  id: 'goal.execute',
  title: 'Run your goal',
  description: 'Turn a business goal into a clear plan with one next step.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runGoalExecute(input, ctx),
  inputSchema: GoalExecuteInputSchema,
  outputSchema: GoalExecuteOutputSchema,
  consequential: false,
  stream: 'sse',
  render: 'plan',
}

// Registered after both capability definitions (module TDZ: the register call
// must run after every capability const is initialized).
registerBuiltinCapabilities()
