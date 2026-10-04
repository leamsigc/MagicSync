import { init } from '@flue/runtime'
import type { AgentComplete } from '../agent/tool-context'
import { createContentIdeasSkill } from '../agentic/skills/create-content-ideas'
import { createMagicSyncAgent } from './magicsync-agent'
import { getFlueRuntime } from './runtime'
import { createSkillTools, type SkillToolContext } from './skill-tools'

/**
 * T09 vertical slice B (PRD §8.2, STOP GATE): *"Give me 10 Facebook ideas
 * about roofing maintenance."*
 *
 * ```text
 * ContentAgent
 *     ↓ topic research (content-intelligence, tenant-scoped)
 *     ↓ business context (Brand Playbook grounding)
 *     ↓ audience context (research brief)
 *     ↓ create-content-ideas
 *     ↓ validation (skill.verify)
 * ```
 *
 * The returned shape reuses the existing content schemas exactly (§8.2 =
 * `ContentIdeasResultSchema`): `{ research, ideas }`, no parallel types.
 * Context integration is the tenant + Brand Playbook grounding every skill
 * call carries (PII subsystem removed in T18; the log policy governs). A
 * failed run yields `CONTENT_INCOMPLETE` — never partial ideas presented
 * as a complete validated set.
 */

export interface SliceBContext {
  userId: string
  businessId: string
  systemContext: string
  complete: AgentComplete
  /** Per-run Flue provider (stub in tests, business provider in production). */
  flueProvider: unknown
  flueModel: string
}

export interface SliceBIdea {
  title: string
  brief: string
  platforms: string[]
  platformDetails: Record<string, unknown>
}

export interface SliceBOutput {
  topic: string
  research: {
    summary: string
    keyInsights: string[]
    audienceInsights: string[]
    businessInsights: string[]
    trends: string[]
    sources: Array<{ label: string, url?: string }>
  }
  ideas: SliceBIdea[]
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function sourceList(value: unknown): Array<{ label: string, url?: string }> {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map(entry => ({
      label: typeof entry.label === 'string' ? entry.label : '',
      ...(typeof entry.url === 'string' ? { url: entry.url } : {}),
    }))
    .filter(entry => entry.label !== '')
}

function ideaList(value: unknown): SliceBIdea[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map(entry => ({
      title: typeof entry.title === 'string' ? entry.title : '',
      brief: typeof entry.brief === 'string' ? entry.brief : '',
      platforms: Array.isArray(entry.platforms)
        ? (entry.platforms as unknown[]).filter((p): p is string => typeof p === 'string')
        : [],
      platformDetails: entry.platformDetails && typeof entry.platformDetails === 'object' && !Array.isArray(entry.platformDetails)
        ? entry.platformDetails as Record<string, unknown>
        : {},
    }))
    .filter(idea => idea.title !== '')
}

export async function runSliceB(
  topic: string,
  platforms: string[],
  ctx: SliceBContext,
  quantity = 10,
): Promise<{ success: true, data: SliceBOutput } | { success: false, error: string, code: string }> {
  const previous: Record<string, unknown> = {}
  const skillCtx: SkillToolContext = {
    userId: ctx.userId,
    businessId: ctx.businessId,
    goal: topic,
    systemContext: ctx.systemContext,
    complete: ctx.complete,
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
  const handle = init(MagicSyncAgent, { id: `slice-b-${crypto.randomUUID()}` })
  const receipt = await handle.dispatch({ message: `Give me ${quantity} ${platforms.join('/')} ideas about ${topic}.` })
  await handle.read(receipt)

  const result = previous['create-content-ideas'] as Record<string, unknown> | undefined
  const verification = createContentIdeasSkill.verify(result)
  if (!verification.ok || !result) {
    return { success: false, error: verification.ok ? 'Slice B produced no validated ideas' : verification.reason, code: 'CONTENT_INCOMPLETE' }
  }
  const research = (result.research ?? {}) as Record<string, unknown>
  const ideas = ideaList(result.ideas)
  if (ideas.length === 0 || typeof research.summary !== 'string' || research.summary === '') {
    return { success: false, error: 'Slice B produced no validated ideas', code: 'CONTENT_INCOMPLETE' }
  }
  return {
    success: true,
    data: {
      topic,
      research: {
        summary: research.summary,
        keyInsights: stringList(research.keyInsights),
        audienceInsights: stringList(research.audienceInsights),
        businessInsights: stringList(research.businessInsights),
        trends: stringList(research.trends),
        sources: sourceList(research.sources),
      },
      ideas,
    },
  }
}
