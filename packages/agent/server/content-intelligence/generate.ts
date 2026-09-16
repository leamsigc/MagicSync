import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import { logPiiScreen } from '../agent/plugins/pii/index'
import { extractJsonObject, type RunConfig } from '../utils/run-config'
import type { AgentComplete } from '../agent/tool-context'
import { renderPrompt } from '../agent/prompts'
import { platformGuidance } from '../services/content-chain.service'
import {
  ContentIdeaSchema,
  dedupeIdeas,
  GenerateContentIdeasInputSchema,
  ResearchResultSchema,
  type ContentIdea,
  type ResearchResult,
} from './schemas'

/**
 * Pi content-intelligence layer: research → synthesis → idea generation →
 * platform adaptation → validation. Persistence-free by design — it returns
 * validated ideas and the application layer (topic-batch pipeline) persists
 * them. Reusable from API routes, MCP tools, or jobs: only needs a RunConfig
 * and an authorized businessId (auth stays in the application layer).
 */

export interface IdeaBusinessContext {
  name: string
  description: string
  industry: string
  location: string
}

export interface ResearchCallInput {
  userId: string
  businessId: string
  topic: string
  run: RunConfig
  event?: H3Event
  log?: RequestLogger
}

export interface ResearchCallResult {
  brief: string
  citations: Array<{ label: string, url?: string }>
  sourcesUsed: number
  usedAgent: boolean
}

export interface ContentIntelligenceDeps {
  /** Agent-first topic research (injected so this module never imports workflow services). */
  research: (input: ResearchCallInput) => Promise<ServiceResponse<ResearchCallResult>>
  /** Model completion bound to the business provider. */
  complete: AgentComplete
  /** Business snapshot loader; defaults to the business profile (null-tolerant). */
  loadBusiness?: (input: { userId: string, businessId: string, event?: H3Event }) => Promise<IdeaBusinessContext | null>
}

export interface GenerateIdeasRequest {
  userId: string
  businessId: string
  topic: string
  quantity: number
  platforms: string[]
  run: RunConfig
  event?: H3Event
  log?: RequestLogger
  options?: {
    researchDepth?: 'light' | 'standard' | 'deep'
    includeBusinessResearch?: boolean
    includeTrends?: boolean
    formatHint?: string
    research?: unknown
  }
}

export interface ContentIntelligence {
  generateContentIdeas: (input: GenerateIdeasRequest) => Promise<ServiceResponse<{
    research: ResearchResult
    ideas: ContentIdea[]
    metadata: {
      requestedQuantity: number
      generatedQuantity: number
      platforms: string[]
      tier: 'llm' | 'brief-derived'
      research: { sourcesUsed: number, usedAgent: boolean, reused: boolean }
      businessGrounded: boolean
      durationMs: number
    }
  }>>
}

const DEPTH_TOKENS = { light: 1200, standard: 2400, deep: 3600 } as const

async function defaultLoadBusiness(input: { userId: string, businessId: string, event?: H3Event }): Promise<IdeaBusinessContext | null> {
  try {
    const res = await businessProfileService.findById(input.businessId, input.userId, input.event)
    if (!res.success || !res.data) return null
    return {
      name: res.data.name,
      description: res.data.description ?? '',
      industry: res.data.category ?? '',
      location: res.data.address ?? '',
    }
  } catch {
    return null
  }
}

function businessBlock(business: IdeaBusinessContext | null): string {
  if (!business) return 'Business profile unavailable — generate topic-only ideas.'
  const lines = [
    business.name ? `- Name: ${business.name}` : '',
    business.description ? `- Description: ${business.description}` : '',
    business.industry ? `- Industry: ${business.industry}` : '',
    business.location ? `- Location: ${business.location}` : '',
  ].filter(line => line.length > 0)
  return lines.length > 0 ? lines.join('\n') : 'Business profile unavailable — generate topic-only ideas.'
}

/**
 * Last-resort ideas derived deterministically from the research brief, so a
 * batch almost always yields cards. Grounded by construction: every card
 * quotes the brief and links its first citation.
 */
/**
 * A sentence that is mostly links carries no angle. Strip markdown links,
 * bare URLs, and bullets, then require real words — a sources-only blob
 * like "Sources: - Label (https://…)" collapses to a few fragments.
 */
function hasSubstance(sentence: string): boolean {
  if (sentence.trim().length < 20) return false
  if (!/https?:\/\/|\[.*?\]\(.*?\)/.test(sentence)) return true
  const text = sentence
    .replace(/\[.*?\]\(.*?\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  return text.split(/\s+/).filter(word => word.length > 0).length >= 6
}

export function deriveIdeasFromBrief(input: {
  brief: string
  topic: string
  platforms: string[]
  count: number
  sourceUrl?: string
}): Array<{ title: string, brief: string, platforms: string[], sourceRef?: string }> {
  const sentences = input.brief
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 20 && hasSubstance(sentence))
    .slice(0, input.count)
  return sentences.map(sentence => ({
    title: sentence.length > 90 ? `${sentence.slice(0, 87)}…` : sentence,
    brief: `Research-backed angle on ${input.topic}: ${sentence}`,
    platforms: input.platforms,
    ...(input.sourceUrl ? { sourceRef: input.sourceUrl } : {}),
  }))
}

export function createContentIntelligence(deps: ContentIntelligenceDeps): ContentIntelligence {
  async function resolveBusiness(input: GenerateIdeasRequest, include: boolean): Promise<IdeaBusinessContext | null> {
    if (!include) return null
    const loader = deps.loadBusiness ?? defaultLoadBusiness
    const business = await loader({ userId: input.userId, businessId: input.businessId, event: input.event })
    emitLog(input.log, { message: 'content-intelligence.business', grounded: business !== null })
    return business
  }

  async function resolveResearch(
    input: GenerateIdeasRequest,
    topic: string,
  ): Promise<{ research: ResearchResult, sourcesUsed: number, usedAgent: boolean, reused: boolean }> {
    const precomputed = ResearchResultSchema.safeParse(input.options?.research)
    if (precomputed.success) {
      return { research: precomputed.data, sourcesUsed: precomputed.data.sources.length, usedAgent: false, reused: true }
    }
    const result = await deps.research({
      userId: input.userId,
      businessId: input.businessId,
      topic,
      run: input.run,
      event: input.event,
      log: input.log,
    })
    if (!result.success) throw new Error(result.error)
    return {
      research: {
        summary: result.data.brief,
        keyInsights: [],
        audienceInsights: [],
        businessInsights: [],
        trends: [],
        contentAngles: [],
        sources: result.data.citations,
      },
      sourcesUsed: result.data.sourcesUsed,
      usedAgent: result.data.usedAgent,
      reused: false,
    }
  }

  function generationPrompt(
    topic: string,
    quantity: number,
    platforms: string[],
    business: string,
    research: ResearchResult,
    includeTrends: boolean,
    formatHint?: string,
  ): string {
    return renderPrompt('ideaGeneration', {
      business,
      topic,
      quantity: String(quantity),
      platforms: platforms.join(', '),
      format: formatHint ?? '',
      research: [
        research.summary,
        research.trends.length > 0 ? `Trends: ${research.trends.join('; ')}` : '',
        research.keyInsights.length > 0 ? `Key insights: ${research.keyInsights.join('; ')}` : '',
        research.sources.length > 0 ? `Sources: ${research.sources.map(source => source.url ?? source.label).join(', ')}` : '',
      ].filter(part => part.length > 0).join('\n'),
      platformRules: platformGuidance(platforms),
    }) + (includeTrends ? '' : '\nPrefer evergreen angles over trend-chasing ones.')
  }

  /**
   * Lenient per-item validation: one malformed idea no longer discards the
   * whole batch. Invalid entries are dropped, valid ones kept.
   */
  function parseIdeas(raw: string, platforms: string[]): ContentIdea[] {
    const ideas = extractJsonObject(raw)?.ideas
    if (!Array.isArray(ideas)) return []
    const valid: ContentIdea[] = []
    for (const item of ideas.slice(0, 31)) {
      const parsed = ContentIdeaSchema.safeParse(item)
      if (!parsed.success) continue
      valid.push({
        ...parsed.data,
        platforms: parsed.data.platforms.length > 0 ? parsed.data.platforms : platforms,
      })
    }
    return dedupeIdeas(valid)
  }

  async function tryComplete(prompt: string, maxTokens: number): Promise<string> {
    try {
      return await deps.complete({ prompt, maxTokens })
    } catch {
      return ''
    }
  }

  async function generateWithRepair(prompt: string, maxTokens: number, platforms: string[]): Promise<ContentIdea[]> {
    const first = parseIdeas(await tryComplete(prompt, maxTokens), platforms)
    if (first.length > 0) return first
    const retry = await tryComplete(
      `The previous output was not valid strict JSON in the shape {"ideas": [{"title": "...", "brief": "...", "platforms": [...], "platformDetails": {}}]}. Return ONLY that JSON, no prose, no fences.\n\nOriginal task:\n${prompt.slice(0, 2000)}`,
      1200,
    )
    return parseIdeas(retry, platforms)
  }

  async function generateContentIdeas(input: GenerateIdeasRequest) {
    const startedAt = Date.now()
    const parsed = GenerateContentIdeasInputSchema.safeParse({
      userId: input.userId,
      businessId: input.businessId,
      topic: input.topic,
      quantity: input.quantity,
      platforms: input.platforms,
      options: input.options ?? {},
    })
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' }
    }
    const valid = parsed.data
    const depth = valid.options.researchDepth
    try {
      const business = await resolveBusiness(input, valid.options.includeBusinessResearch)
      logPiiScreen(input.log, 'topic', valid.topic)
      const { research, sourcesUsed, usedAgent, reused } = await resolveResearch(input, valid.topic)
      logPiiScreen(input.log, 'research-brief', research.summary)
      const ideas = await generateWithRepair(
        generationPrompt(valid.topic, valid.quantity, valid.platforms, businessBlock(business), research, valid.options.includeTrends, valid.options.formatHint),
        DEPTH_TOKENS[depth],
        valid.platforms,
      )
      const final = ideas.length > 0
        ? { cards: ideas, tier: 'llm' as const }
        : {
            cards: deriveIdeasFromBrief({
              brief: research.summary,
              topic: valid.topic,
              platforms: valid.platforms,
              count: valid.quantity,
              sourceUrl: research.sources[0]?.url,
            }),
            tier: 'brief-derived' as const,
          }
      logPiiScreen(input.log, 'ideas', final.cards.map(card => `${card.title}\n${card.brief}`).join('\n'))
      emitLog(input.log, {
        message: 'content-intelligence.completed',
        tier: final.tier,
        requested: valid.quantity,
        generated: final.cards.length,
        durationMs: Date.now() - startedAt,
      })
      return {
        success: true as const,
        data: {
          research,
          ideas: final.cards,
          metadata: {
            requestedQuantity: valid.quantity,
            generatedQuantity: final.cards.length,
            platforms: valid.platforms,
            tier: final.tier,
            research: { sourcesUsed, usedAgent, reused },
            businessGrounded: business !== null,
            durationMs: Date.now() - startedAt,
          },
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Content idea generation failed'
      emitLog(input.log, { message: 'content-intelligence.failed', error: message })
      return { success: false as const, error: message }
    }
  }

  return { generateContentIdeas }
}
