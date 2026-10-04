import { defineTool, useModel, useSubagent, useTool, type AgentProps, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { routeGoal } from '../agentic/planner'
import { agentBinding } from './agent-bindings'
import { useSpecialists, type SpecialistOptions } from './specialists'

/**
 * T05 `MagicSyncAgent` — the top-level Flue agent function (PRD §4.4, §7).
 *
 * Understand goal → choose capabilities → load context → delegate → combine →
 * verify → answer. Delegation to specialists lands in T06 (`useSubagent`);
 * this task proves the agent boots in Flue, mounts a deterministic tool, and
 * executes a bounded task end-to-end with no network and no API keys.
 *
 * Flue is the only orchestration runtime; the planner routing table survives
 * only as the deterministic `plan_lookup` tool (zero model calls when a goal
 * matches), not as a second orchestrator (locked decision 3).
 */

export const MAGICSYNC_AGENT_NAME = 'MagicSyncAgent'

const PlanLookupInput = v.object({ goal: v.pipe(v.string(), v.minLength(1)) })

export interface PlanLookupStep {
  id: string
  title: string
}

export interface PlanLookupResult {
  routed: boolean
  steps: PlanLookupStep[]
}

/** Deterministic goal → plan match. Pure: zero model calls, no I/O. */
export function lookupPlan(goal: string): PlanLookupResult {
  const plan = routeGoal(goal)
  if (!plan) return { routed: false, steps: [] }
  return {
    routed: true,
    steps: plan.steps.map(step => ({ id: step.id, title: step.title })),
  }
}

/** The single deterministic tool mounted on the top-level agent. */
export function createPlanLookupTool() {
  return defineTool({
    name: 'plan_lookup',
    description: 'Match a business goal to a known plan. Call this first.',
    input: PlanLookupInput,
    run: async (toolCtx) => ({ output: lookupPlan(toolCtx.data.goal) }),
  })
}

export interface MagicSyncAgentOptions extends SpecialistOptions {}

function buildInstructions(systemContext: string): string {
  const base = [
    'You help a business owner get more customers.',
    'First call plan_lookup with their goal.',
    'When it matches, present the steps in plain words with one clear next step.',
    'When it does not match, say what you need to make a plan.',
    'Never mention agents, skills, tools, models, or orchestration.',
  ].join(' ')
  if (systemContext === '') return base
  return `${base}\n\nBusiness context:\n${systemContext}`
}

/**
 * Build the top-level agent bound to one run's model + context. The factory
 * keeps per-run credentials out of module scope: the provider behind `model`
 * is registered per run (see `flue/runtime.ts`), never shared. The four
 * specialists mount via `useSubagent` (T06); tenant flows through for
 * grounded tools.
 */
export function createMagicSyncAgent(options: MagicSyncAgentOptions) {
  function MagicSyncAgent(): string {
    useModel(options.model)
    useTool(createPlanLookupTool())
    useSpecialists(options)
    return buildInstructions(options.systemContext ?? '')
  }
  Object.defineProperty(MagicSyncAgent, 'name', { value: MAGICSYNC_AGENT_NAME })
  return MagicSyncAgent
}

/** Flue model specifier from the deployment defaults (overridden per run). */
export function defaultModelSpecifier(): string {
  const provider = process.env.AGENT_DEFAULT_PROVIDER ?? 'stub'
  const model = process.env.AGENT_DEFAULT_MODEL ?? 'stub-model'
  return `${provider}/${model}`
}

/**
 * Mount the server-owned tool bag of a bound conversation (T29). The mount is
 * already narrowed and guarded by `agent/tools/mounts.ts`, so this only hands
 * the tools to Flue — the model never names one.
 */
function useBoundTools(tools: readonly ToolDefinition[]): void {
  for (const tool of tools) useTool(tool)
}

/**
 * The one registered agent identity the whole product dispatches to (T29).
 *
 * A conversation the server bound (`flue/agent-bindings.ts`) renders its own
 * model specifier, guarded tool mount and system instruction — that is the chat
 * runner's path and the completion helper's path. An unbound conversation
 * renders the deployment-default agent below, which is what the T25 HTTP mount
 * and the T05 spike exercise.
 */
export function MagicSyncAgent(props: AgentProps): string {
  const binding = agentBinding(props?.id)
  if (!binding) {
    useModel(defaultModelSpecifier())
    useTool(createPlanLookupTool())
    return buildInstructions('')
  }
  useModel(binding.model)
  useBoundTools(binding.tools)
  for (const subagent of binding.subagents ?? []) useSubagent(subagent)
  return binding.instructions
}
MagicSyncAgent.agentName = MAGICSYNC_AGENT_NAME
