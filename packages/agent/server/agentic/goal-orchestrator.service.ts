import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import { goalRunService } from '#layers/BaseDB/server/services/goal-run.service'
import type { AgentPlan, ExecutableSkill, GoalStep, GoalStepState, SkillRunContext } from './contracts'
import { AgentPlanSchema, GoalStepStateSchema } from './contracts'
import { specialistsForSkill } from '../flue/specialists'
import '../flue/skills'
import { assembleGoalContext } from './context-selector'
import { createGoalEventEmitter, type GoalStreamEmitter, type GoalStreamEventListener } from './goal-events'
import { planForGoal } from './planner'
import { stepLabel } from './progress'
import { classifyError, runWithRecovery } from './recovery'
import { goalSkillRegistry as skillRegistry } from '../flue/skills'


/**
 * The agentic orchestrator: one bounded loop — understand → plan → select →
 * execute → verify → recover → approve. Chat, API, MCP and jobs all call this
 * service; none of them implement their own orchestration.
 */

const MAX_STEP_RETRIES = 2

export interface ExecuteGoalInput {
  userId: string
  businessId: string
  goal: string
  /** Completion bound to the caller's model (RunConfig.complete). */
  complete: NonNullable<SkillRunContext['complete']>
  /** Extra system context appended to the assembled business context. */
  systemContext?: string
  event?: H3Event
  log?: RequestLogger
  onEvent?: GoalStreamEventListener
  stepInputOverrides?: Record<string, Record<string, unknown>>
}

export interface ResumeGoalInput {
  userId: string
  runId: string
  approved: boolean
  complete: NonNullable<SkillRunContext['complete']>
  systemContext?: string
  event?: H3Event
  log?: RequestLogger
  onEvent?: GoalStreamEventListener
}

export type GoalExecutionResult =
  | { goalRunId: string, status: 'completed', summary: string, result: unknown }
  | { goalRunId: string, status: 'waiting_for_approval', stepId: string, title: string, label: string }
  | { goalRunId: string, status: 'failed', error: string, code?: string }
  | { goalRunId: string, status: 'cancelled' }

interface StepOutcome {
  kind: 'completed' | 'failed' | 'waiting'
  stepId?: string
  title?: string
  label?: string
  error?: string
  code?: string
}

interface RunEnv {
  input: ExecuteGoalInput
  runId: string
  plan: AgentPlan
  systemContext: string
  emit: GoalStreamEmitter
  states: GoalStepState[]
  previous: Record<string, unknown>
  /** Steps the human already approved; consequential flags are skipped for them. */
  approvedSteps: Set<string>
}

const SSE_STATUS: Record<GoalStepState['status'], 'running' | 'completed' | 'failed' | 'waiting_approval' | undefined> = {
  pending: undefined,
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  skipped: undefined,
  waiting_approval: 'waiting_approval',
}

function toPending(step: GoalStep): GoalStepState {
  return { id: step.id, skill: step.skill, title: step.title, status: 'pending', error: null }
}

function planView(plan: AgentPlan) {
  return plan.steps.map(step => ({ id: step.id, skill: step.skill, label: stepLabel(step.skill, step.title), type: step.type }))
}

function resultSummary(states: GoalStepState[]): string {
  const last = [...states].reverse().find(state => state.status === 'completed')
  return last ? `${last.title} completed` : 'Goal completed'
}

export class GoalOrchestratorService {
  async executeGoal(input: ExecuteGoalInput): Promise<GoalExecutionResult> {
    if (!input.goal.trim()) {
      return { goalRunId: '', status: 'failed', error: 'Goal text is required', code: 'VALIDATION_ERROR' }
    }
    const started = await goalRunService.start(input.userId, { businessId: input.businessId, goal: input.goal })
    if (!started.success) {
      return { goalRunId: '', status: 'failed', error: started.error, code: started.code }
    }
    const runId = started.data.id
    const emit = createGoalEventEmitter(runId, input.onEvent ?? (() => {}))
    emit({ type: 'goal.started', goalRunId: runId, goal: input.goal })
    emitLog(input.log, { message: 'goal.started', goalRunId: runId })

    const context = await assembleGoalContext(input.userId, input.businessId, input.event)
    if (!context.success) return this.failRun(input, runId, emit, context.error, context.code)
    const systemContext = [context.data.systemContext, input.systemContext].filter(Boolean).join('\n\n')

    const planned = await planForGoal({ goal: input.goal, complete: input.complete, systemContext })
    if (!planned.success) return this.failRun(input, runId, emit, planned.error, planned.code)

    emit({ type: 'goal.plan', goalRunId: runId, summary: planned.data.summary, steps: planView(planned.data) })
    emitLog(input.log, { message: 'goal.planned', goalRunId: runId, steps: planned.data.steps.length })
    const env: RunEnv = {
      input,
      runId,
      plan: planned.data,
      systemContext,
      emit,
      states: planned.data.steps.map(toPending),
      previous: {},
      approvedSteps: new Set(),
    }
    await goalRunService.setPlan(runId, { plan: planned.data, steps: env.states })
    return this.runFrom(env, 0)
  }

  /** Resume a paused run: approve to continue, reject to cancel. */
  async resume(input: ResumeGoalInput): Promise<GoalExecutionResult> {
    const loaded = await goalRunService.get(input.userId, input.runId)
    if (!loaded.success || !loaded.data) {
      return { goalRunId: input.runId, status: 'failed', error: loaded.error ?? 'Goal run not found', code: loaded.code ?? 'NOT_FOUND' }
    }
    const run = loaded.data
    if (run.status !== 'waiting_for_approval') {
      return { goalRunId: run.id, status: 'failed', error: `Run is not waiting for approval (status: ${run.status})`, code: 'INVALID_STATE' }
    }
    if (!input.approved) {
      await goalRunService.setStatus(run.id, 'cancelled')
      emitLog(input.log, { message: 'goal.cancelled', goalRunId: run.id })
      return { goalRunId: run.id, status: 'cancelled' }
    }
    const context = await assembleGoalContext(input.userId, run.businessId, input.event)
    if (!context.success) {
      return { goalRunId: run.id, status: 'failed', error: context.error, code: context.code }
    }
    const plan = AgentPlanSchema.parse(JSON.parse(run.plan))
    const states = GoalStepStateSchema.array().parse(JSON.parse(run.steps))
    const emit = createGoalEventEmitter(run.id, input.onEvent ?? (() => {}))
    emitLog(input.log, { message: 'goal.approved', goalRunId: run.id })
    const waitingStep = states.find(state => state.status === 'waiting_approval')
    const approvedSteps = new Set(waitingStep ? [waitingStep.id] : [])
    const env: RunEnv = {
      input: {
        userId: input.userId,
        businessId: run.businessId,
        goal: run.goal,
        complete: input.complete,
        systemContext: input.systemContext,
        event: input.event,
        log: input.log,
      },
      runId: run.id,
      plan,
      systemContext: [context.data.systemContext, input.systemContext].filter(Boolean).join('\n\n'),
      emit,
      states,
      previous: Object.fromEntries(states.filter(state => state.status === 'completed').map(state => [state.id, state.result])),
      approvedSteps,
    }
    return this.runFrom(env, waitingStep ? states.indexOf(waitingStep) : 0)
  }

  async cancel(userId: string, runId: string): Promise<GoalExecutionResult> {
    const loaded = await goalRunService.get(userId, runId)
    if (!loaded.success || !loaded.data) {
      return { goalRunId: runId, status: 'failed', error: loaded.error ?? 'Goal run not found', code: loaded.code ?? 'NOT_FOUND' }
    }
    const finished = ['completed', 'failed', 'cancelled'].includes(loaded.data.status)
    if (finished) {
      return { goalRunId: runId, status: 'failed', error: `Run already finished (status: ${loaded.data.status})`, code: 'INVALID_STATE' }
    }
    await goalRunService.setStatus(runId, 'cancelled')
    return { goalRunId: runId, status: 'cancelled' }
  }

  async get(userId: string, runId: string): Promise<ServiceResponse<unknown>> {
    return goalRunService.get(userId, runId)
  }

  async list(userId: string, businessId: string, limit?: number): Promise<ServiceResponse<unknown[]>> {
    return goalRunService.listByBusiness(userId, businessId, limit)
  }

  private async runFrom(env: RunEnv, startIndex: number): Promise<GoalExecutionResult> {
    if (startIndex === 0) await goalRunService.setStatus(env.runId, 'running')
    for (let index = startIndex; index < env.plan.steps.length; index += 1) {
      const step = env.plan.steps[index]
      if (!step) break
      const outcome = await this.runStep(env, step)
      if (outcome.kind === 'waiting') {
        await goalRunService.setStatus(env.runId, 'waiting_for_approval')
        return {
          goalRunId: env.runId,
          status: 'waiting_for_approval',
          stepId: outcome.stepId ?? '',
          title: outcome.title ?? '',
          label: outcome.label ?? '',
        }
      }
      if (outcome.kind === 'failed') {
        await goalRunService.setStatus(env.runId, 'failed', { error: outcome.error })
        env.emit({ type: 'goal.failed', goalRunId: env.runId, status: 'failed', code: outcome.code, message: outcome.error ?? 'Step failed' })
        emitLog(env.input.log, { message: 'goal.failed', goalRunId: env.runId, error: outcome.error })
        return { goalRunId: env.runId, status: 'failed', error: outcome.error ?? 'Step failed', code: outcome.code }
      }
    }
    const summary = resultSummary(env.states)
    const result = this.finalResult(env)
    await goalRunService.setStatus(env.runId, 'completed', { result })
    env.emit({ type: 'goal.completed', goalRunId: env.runId, summary, result })
    emitLog(env.input.log, { message: 'goal.completed', goalRunId: env.runId })
    return { goalRunId: env.runId, status: 'completed', summary, result }
  }

  private async runStep(env: RunEnv, step: GoalStep): Promise<StepOutcome> {
    const skill = skillRegistry.get(step.skill)
    if (!skill) return { kind: 'failed', error: `Unknown skill: ${step.skill}`, code: 'SKILL_UNKNOWN' }
    const parsed = skill.inputSchema.safeParse({ ...(step.input ?? {}), ...(env.input.stepInputOverrides?.[step.id] ?? {}) })
    if (!parsed.success) {
      return { kind: 'failed', error: `Invalid input for ${step.skill}: ${parsed.error.issues[0]?.message ?? ''}`, code: 'VALIDATION_ERROR' }
    }
    const label = stepLabel(step.skill, step.title)
    this.markStep(env, step.id, 'running', label)
    const outcome = await runWithRecovery(
      () => skill.run(this.skillContext(env), parsed.data),
      {
        maxRetries: MAX_STEP_RETRIES,
        onRetry: (attempt, error) => emitLog(env.input.log, { message: 'goal.step.retry', stepId: step.id, attempt, error }),
      },
    )
    if (!outcome.success) return this.failStep(env, step, label, skill, outcome)
    const verification = skill.verify(outcome.data)
    if (!verification.ok) {
      return this.failStep(env, step, label, skill, { success: false, error: verification.reason ?? 'Verification failed', code: 'SKILL_VERIFICATION_FAILED' })
    }
    return this.completeStep(env, step, skill, outcome.data, label)
  }

  private async failStep(env: RunEnv, step: GoalStep, label: string, skill: ExecutableSkill, outcome: { success?: boolean, error?: string, code?: string }): Promise<StepOutcome> {
    const kind = classifyError(outcome.error ?? '', outcome.code)
    const error = kind === 'requires-user'
      ? `${step.title} needs your input: ${outcome.error}`
      : `${step.title} failed: ${outcome.error}`
    emitLog(env.input.log, { message: 'goal.step.failed', stepId: step.id, skill: skill.id, kind, error })
    this.markStep(env, step.id, 'failed', label, error)
    return { kind: 'failed', error, code: outcome.code }
  }

  private async completeStep(env: RunEnv, step: GoalStep, skill: ExecutableSkill, data: unknown, label: string): Promise<StepOutcome> {
    const alreadyApproved = env.approvedSteps.has(step.id)
    if (skill.consequential && !alreadyApproved) {
      this.markStep(env, step.id, 'waiting_approval', label)
      await goalRunService.updateSteps(env.runId, env.states)
      env.emit({ type: 'goal.approval_required', goalRunId: env.runId, stepId: step.id, label, title: step.title })
      emitLog(env.input.log, { message: 'goal.approval.required', goalRunId: env.runId, stepId: step.id, skill: skill.id })
      return { kind: 'waiting', stepId: step.id, title: step.title, label }
    }
    this.markStep(env, step.id, 'completed', label)
    const state = env.states.find(entry => entry.id === step.id)
    if (state) state.result = data
    env.previous[step.id] = data
    await goalRunService.updateSteps(env.runId, env.states)
    return { kind: 'completed' }
  }

  private markStep(env: RunEnv, stepId: string, status: GoalStepState['status'], label: string, error?: string): void {
    const state = env.states.find(entry => entry.id === stepId)
    if (state) {
      state.status = status
      state.error = error ?? null
    }
    const sse = SSE_STATUS[status]
    if (sse) env.emit({ type: 'goal.step', goalRunId: env.runId, stepId, label, status: sse })
  }

  private failRun(input: ExecuteGoalInput, runId: string, emit: GoalStreamEmitter, error?: string, code?: string): GoalExecutionResult {
    void goalRunService.setStatus(runId, 'failed', { error })
    emit({ type: 'goal.failed', goalRunId: runId, status: 'failed', code, message: error ?? 'Goal failed' })
    emitLog(input.log, { message: 'goal.failed', goalRunId: runId, error })
    return { goalRunId: runId, status: 'failed', error: error ?? 'Goal failed', code }
  }

  private skillContext(env: RunEnv): SkillRunContext {
    return {
      userId: env.input.userId,
      businessId: env.input.businessId,
      goal: env.input.goal,
      systemContext: env.systemContext,
      complete: env.input.complete,
      event: env.input.event,
      log: env.input.log,
      previous: env.previous,
    }
  }

  private finalResult(env: RunEnv): unknown {
    const agents = [...new Set(env.plan.steps.flatMap(step => specialistsForSkill(step.skill)))]
    return { summary: resultSummary(env.states), steps: env.states, agents, goal: env.input.goal }
  }
}

export const goalOrchestratorService = new GoalOrchestratorService()
