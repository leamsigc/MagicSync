import { init } from '@flue/runtime'
import type { AgentComplete } from '../agent/tool-context'
import type { LangSearchClient } from '../utils/langsearch'
import { createMagicSyncAgent } from './magicsync-agent'
import { getFlueRuntime } from './runtime'
import { createSkillTools, type SkillToolContext } from './skill-tools'

/**
 * T08 vertical slice A (PRD §8.1, STOP GATE): *"Help me get more customers."*
 *
 * ```text
 * MagicSyncAgent
 *     ↓ BusinessAgent → analyze-business
 *     ↓ ResearchAgent → research-competitors
 *     ↓ discover-opportunities (StrategyAgent mount)
 *     ↓ StrategyAgent → create-marketing-plan
 *     ↓ identify-next-action (BusinessAgent mount)
 * ```
 *
 * Skill tools share one per-run evidence store, so research chains
 * deterministically into analysis → opportunities → plan → next action. The
 * reply is rendered from validated tool outputs in plain language — never
 * model prose, never internal vocabulary. Missing pieces fail loud
 * (`GOAL_INCOMPLETE`); partial output is never presented as complete.
 */

export interface SliceAContext {
  userId: string
  businessId: string
  systemContext: string
  complete: AgentComplete
  langsearch?: LangSearchClient
  langsearchKey?: string | null
  /** Per-run Flue provider (stub in tests, business provider in production). */
  flueProvider: unknown
  flueModel: string
}

export interface SliceAOpportunity {
  title: string
  rationale: string
}

export interface SliceANextStep {
  title: string
  why: string
  how: string
}

export interface SliceAOutput {
  goal: string
  opportunities: SliceAOpportunity[]
  nextStep: SliceANextStep
  plan: { title: string, actions: string[] }
  reply: string
  /** The `[Show me the plan]` affordance is available for this run. */
  showPlanAction: true
}

interface OpportunityRaw {
  title: unknown
  rationale: unknown
  priority: unknown
}

function opportunityList(value: unknown): SliceAOpportunity[] {
  if (!value || typeof value !== 'object') return []
  const list = (value as { opportunities?: unknown }).opportunities
  if (!Array.isArray(list)) return []
  return list
    .filter((entry): entry is OpportunityRaw => !!entry && typeof entry === 'object')
    .map(entry => ({
      title: typeof entry.title === 'string' ? entry.title : '',
      rationale: typeof entry.rationale === 'string' ? entry.rationale : '',
      priority: typeof entry.priority === 'number' ? entry.priority : 99,
    }))
    .filter(entry => entry.title !== '')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map(({ title, rationale }) => ({ title, rationale }))
}

function nextStepOf(value: unknown): SliceANextStep | null {
  if (!value || typeof value !== 'object') return null
  const action = (value as { nextAction?: unknown }).nextAction
  if (!action || typeof action !== 'object') return null
  const { title, why, how } = action as Record<string, unknown>
  if (typeof title !== 'string' || title === '') return null
  if (typeof why !== 'string' || typeof how !== 'string') return null
  return { title, why, how }
}

function planOf(value: unknown): { title: string, actions: string[] } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { planTitle?: unknown, phases?: unknown }
  if (typeof record.planTitle !== 'string' || !Array.isArray(record.phases)) return null
  const actions = record.phases.flatMap(phase => {
    if (!phase || typeof phase !== 'object') return []
    const list = (phase as { actions?: unknown }).actions
    if (!Array.isArray(list)) return []
    return list
      .map(action => (action && typeof action === 'object' ? (action as { title?: unknown }).title : undefined))
      .filter((title): title is string => typeof title === 'string' && title !== '')
  }).slice(0, 6)
  if (actions.length === 0) return null
  return { title: record.planTitle, actions }
}

function buildReply(opportunities: SliceAOpportunity[]): string {
  const lines = opportunities.map((opportunity, index) => `${index + 1}. ${opportunity.title}${opportunity.rationale ? ` — ${opportunity.rationale}` : ''}`)
  return [
    `I found ${opportunities.length} good ${opportunities.length === 1 ? 'opportunity' : 'opportunities'}.`,
    '',
    ...lines,
    '',
    'I think you should start with #1.',
  ].join('\n')
}

export async function runSliceA(
  goal: string,
  ctx: SliceAContext,
): Promise<{ success: true, data: SliceAOutput } | { success: false, error: string, code: string }> {
  const previous: Record<string, unknown> = {}
  const skillCtx: SkillToolContext = {
    userId: ctx.userId,
    businessId: ctx.businessId,
    goal,
    systemContext: ctx.systemContext,
    complete: ctx.complete,
    langsearch: ctx.langsearch,
    langsearchKey: ctx.langsearchKey,
    previous,
  }
  const skillTools = createSkillTools(skillCtx)
  const MagicSyncAgent = createMagicSyncAgent({
    model: ctx.flueModel,
    systemContext: ctx.systemContext,
    userId: ctx.userId,
    businessId: ctx.businessId,
    skillTools,
  })
  await getFlueRuntime({ agents: [MagicSyncAgent], providers: [ctx.flueProvider] })
  const handle = init(MagicSyncAgent, { id: `slice-a-${crypto.randomUUID()}` })
  const receipt = await handle.dispatch({ message: goal })
  await handle.read(receipt)

  const opportunities = opportunityList(previous['discover-opportunities'])
  const nextStep = nextStepOf(previous['identify-next-action'])
  const plan = planOf(previous['create-marketing-plan'])
  if (opportunities.length === 0 || !nextStep || !plan) {
    return { success: false, error: 'Slice A did not produce opportunities, a plan, and a next step', code: 'GOAL_INCOMPLETE' }
  }
  return {
    success: true,
    data: {
      goal,
      opportunities,
      nextStep,
      plan,
      reply: buildReply(opportunities),
      showPlanAction: true as const,
    },
  }
}
