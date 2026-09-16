import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import { contentBoardService, type ContentCardInput } from '#layers/BaseDB/server/services/content-board.service'
import type { ContentItem } from '#layers/BaseDB/db/schema'
import { buildAgentRunConfig, type RunConfig } from '../utils/run-config'
import { platformGuidance } from './content-chain.service'
import { agentRunnerService } from './agent-runner.service'
import { agentRunService } from './agent-run.service'
import { renderPrompt, TOPIC_SCAN_KIND_HINTS } from '../agent/prompts'
import { createContentIntelligence, normalizeIdeaTitle } from '../content-intelligence/index'

/**
 * Topic batch pipeline: research a topic, scan trends grounded in that
 * research, and persist platform-tailored idea cards. The whole flow lives
 * in this class so it reads start-to-end in one place:
 *
 *   start() → validate → run config (business grounding) → tracking run
 *   execute() → research → scout → plugin-fill → persist
 *
 * The trend-scout agent runs first for live signals; the
 * content-intelligence plugin (`generateContentIdeas`) then fills the
 * shortfall to the requested count (grounded LLM, brief-derived last
 * resort), so the plugin runs on every batch the scout does not fully
 * satisfy. Scout cards are already persisted by the board tool — only
 * plugin cards are inserted. Research itself is agent-first with a service
 * fallback (injected so this file never imports the workflow service).
 */

export type TopicBatchKind = 'days' | 'carousel' | 'reel' | 'repurpose'

export interface TopicBatchInput {
  userId: string
  businessId: string
  kind: TopicBatchKind
  days: number
  platforms: string[]
  topic: string
  event: H3Event
  log?: RequestLogger
}

export interface TopicBatchExecution {
  userId: string
  businessId: string
  kind: TopicBatchKind
  platforms: string[]
  topic: string
  runId: string
  count: number
  run: RunConfig
  event?: H3Event
  log?: RequestLogger
}

export interface BatchResearchInput {
  userId: string
  businessId: string
  topic: string
  run: RunConfig
  event?: H3Event
  log?: RequestLogger
}

export interface BatchResearchResult {
  brief: string
  citations: Array<{ label: string, url?: string }>
  keyFacts: string[]
  sourcesUsed: number
  usedAgent: boolean
  agentRunId?: string
}

export interface TopicBatchDeps {
  research: (input: BatchResearchInput) => Promise<ServiceResponse<BatchResearchResult>>
}

/** Days kind creates one idea per day; other kinds create a focused set of 3. */
export function topicBatchCount(kind: TopicBatchKind, days: number): number {
  const requested = kind === 'days' ? days : 3
  return Math.min(Math.max(requested, 1), 31)
}

function researchTopicFor(topic: string, platforms: string[]): string {
  if (platforms.length === 0) return topic
  return `${topic} (content angles for ${platforms.join(', ')})`
}

function describePlatforms(platforms: string[]): string {
  if (platforms.length === 0) return 'general social'
  return platforms.join(', ')
}

export function composeTopicScanText(input: {
  topic: string
  platforms: string[]
  count: number
  kind: TopicBatchKind
  brief: string
}): string {
  return renderPrompt('topicScan', {
    topic: input.topic,
    platformList: describePlatforms(input.platforms),
    count: String(input.count),
    kindHint: TOPIC_SCAN_KIND_HINTS[input.kind] ?? '',
    brief: input.brief,
    platformRules: platformGuidance(input.platforms),
    scanScope: input.platforms[0] ? ` with platform "${input.platforms[0]}"` : '',
  })
}

/** Drop plugin ideas duplicating angles the scout already covered. */
export function excludeScoutedTitles(
  scouted: Array<{ title: string }>,
  fresh: ContentCardInput[],
): ContentCardInput[] {
  const seen = new Set(scouted.map(card => normalizeIdeaTitle(card.title)))
  return fresh.filter((card) => {
    const key = normalizeIdeaTitle(card.title)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function combineLabel(scoutCount: number, tier: 'llm' | 'brief-derived'): string {
  const fallback = tier === 'llm' ? 'llm-fallback' : 'brief-derived'
  if (scoutCount === 0) return fallback
  return `trend-scout+${tier}`
}

/** Cards the trend-scout run created (agent-owned, trend-sourced, recent). */
export async function collectRunCards(
  input: { userId: string, businessId: string, event?: H3Event },
  startedAt: Date,
): Promise<ContentItem[]> {
  const listed = await contentBoardService.list(input.userId, input.businessId, { state: 'idea' }, input.event)
  if (!listed.success) return []
  const cutoff = startedAt.getTime() - 1000
  return listed.data.filter(card =>
    card.createdBy === 'agent'
    && card.sourceType === 'trend'
    && new Date(card.createdAt).getTime() >= cutoff,
  )
}

export class TopicBatchPipeline {
  private deps: TopicBatchDeps

  constructor(deps: TopicBatchDeps) {
    this.deps = deps
  }

  /**
   * Synchronous half: validates, resolves the run config (business
   * grounding), persists the tracking run, and kicks off execute() without
   * awaiting it. The route returns the run id for polling.
   */
  async start(input: TopicBatchInput): Promise<ServiceResponse<{ runId: string, count: number }>> {
    const topic = input.topic.trim()
    if (!topic) return { success: false, error: 'A topic is required to research ideas', code: 'TOPIC_REQUIRED' }
    const count = topicBatchCount(input.kind, input.days)
    const config = await buildAgentRunConfig(input.userId, input.businessId, input.event)
    if (!config.success) return { success: false, error: config.error, code: config.code }
    const started = await agentRunService.start(input.userId, { businessId: input.businessId, agentName: `topic-batch:${input.kind}` })
    if (!started.success) return { success: false, error: started.error, code: started.code }
    const runId = started.data.id
    emitLog(input.log, { message: 'topic-batch.started', runId, kind: input.kind, topic: topic.slice(0, 200), platforms: input.platforms, count })
    void this.execute({
      userId: input.userId,
      businessId: input.businessId,
      kind: input.kind,
      platforms: input.platforms,
      topic,
      event: input.event,
      log: input.log,
      runId,
      count,
      run: config.data,
    })
    return { success: true, data: { runId, count } }
  }

  /**
   * Background half: research → scout → llm-fallback → brief-derived →
   * persist. Never rejects — every failure finishes the tracking run as
   * failed with the reason in its summary.
   */
  async execute(input: TopicBatchExecution): Promise<void> {
    const startedAt = Date.now()
    const shortTopic = input.topic
    try {
      const research = await this.research(input, shortTopic)
      const tier = await this.produceIdeas(input, research)
      await this.recordScouted(input, tier.scouted, tier.agentRunId)
      const added = await this.persistFresh(input, tier.fresh, tier.agentRunId)
      if (!added.success) throw new Error(added.error)
      const total = tier.scouted.length + added.data.length
      if (total === 0) {
        throw new Error(`Trend scan finished without creating idea cards for "${shortTopic}" — try a broader topic or fewer platforms`)
      }
      const summary = `Created ${total} idea cards for "${shortTopic}" (${describePlatforms(input.platforms)}). Research: ${research.sourcesUsed} sources via ${research.viaAgent ? 'research agent' : 'service fallback'}; ideas via ${tier.label}.`
      await agentRunService.finish(input.runId, {
        status: 'completed',
        tokensUsed: tier.tokensUsed,
        durationMs: Date.now() - startedAt,
        summary,
      })
      emitLog(input.log, { message: 'topic-batch.completed', runId: input.runId, tier: tier.label, cards: total, tokensUsed: tier.tokensUsed, durationMs: Date.now() - startedAt })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Topic batch failed'
      await agentRunService.finish(input.runId, { status: 'failed', durationMs: Date.now() - startedAt, summary: message })
      emitLog(input.log, { message: 'topic-batch.failed', runId: input.runId, error: message })
    }
  }

  /** Stage 1 — research the topic (agent-first, service fallback). */
  private async research(
    input: TopicBatchExecution,
    shortTopic: string,
  ): Promise<{ brief: string, citations: Array<{ label: string, url?: string }>, keyFacts: string[], sourcesUsed: number, viaAgent: boolean }> {
    await agentRunService.touch(input.runId, `Researching "${shortTopic}"…`)
    const result = await this.deps.research({
      userId: input.userId,
      businessId: input.businessId,
      topic: researchTopicFor(input.topic, input.platforms),
      run: input.run,
      event: input.event,
      log: input.log,
    })
    if (!result.success) throw new Error(result.error)
    return {
      brief: result.data.brief,
      citations: result.data.citations,
      keyFacts: result.data.keyFacts ?? [],
      sourcesUsed: result.data.sourcesUsed,
      viaAgent: result.data.usedAgent,
    }
  }

  /**
   * Stages 2–4 — trend-scout predefined action first, then the
   * content-intelligence plugin fills the shortfall to the requested count
   * (grounded LLM with repair retry, brief-derived last resort), fed the
   * already-computed research so it is never redone. The plugin runs on
   * every batch that the scout does not fully satisfy.
   */
  private async produceIdeas(
    input: TopicBatchExecution,
    research: { brief: string, citations: Array<{ label: string, url?: string }>, keyFacts: string[], sourcesUsed: number, viaAgent: boolean },
  ): Promise<{ scouted: ContentItem[], fresh: ContentCardInput[], label: string, agentRunId?: string, tokensUsed: number }> {
    await agentRunService.touch(input.runId, `Scanning trends for "${input.topic.slice(0, 80)}"…`)
    const scouted = await this.scoutWithAgent(input, research.brief)
    const remaining = Math.max(input.count - scouted.cards.length, 0)
    if (remaining === 0) return { scouted: scouted.cards, fresh: [], label: 'trend-scout', agentRunId: scouted.agentRunId, tokensUsed: scouted.tokensUsed }
    emitLog(input.log, { message: 'topic-batch.scout-partial', runId: input.runId, scouted: scouted.cards.length, needed: remaining })
    const intelligence = createContentIntelligence({
      research: async () => ({
        success: true as const,
        data: {
          brief: research.brief,
          citations: research.citations,
          sourcesUsed: research.sourcesUsed,
          usedAgent: research.viaAgent,
        },
      }),
      complete: input.run.complete,
    })
    const generated = await intelligence.generateContentIdeas({
      userId: input.userId,
      businessId: input.businessId,
      topic: input.topic,
      quantity: remaining,
      platforms: input.platforms,
      run: input.run,
      event: input.event,
      log: input.log,
      options: {
        formatHint: TOPIC_SCAN_KIND_HINTS[input.kind],
        research: {
          summary: research.brief,
          keyInsights: research.keyFacts,
          audienceInsights: [],
          businessInsights: [],
          trends: [],
          contentAngles: [],
          sources: research.citations,
        },
      },
    })
    if (!generated.success) throw new Error(generated.error)
    const fresh = excludeScoutedTitles(scouted.cards, generated.data.ideas.map(idea => ({
      title: idea.title,
      brief: idea.brief,
      platforms: idea.platforms,
    })))
    return {
      scouted: scouted.cards,
      fresh,
      label: combineLabel(scouted.cards.length, generated.data.metadata.tier),
      agentRunId: scouted.agentRunId,
      tokensUsed: scouted.tokensUsed,
    }
  }

  /** Stage 2 — trend-scout predefined action grounded in the research brief. */
  private async scoutWithAgent(
    input: TopicBatchExecution,
    brief: string,
  ): Promise<{ cards: ContentItem[], agentRunId?: string, tokensUsed: number }> {
    const scan = await agentRunnerService.runTask({
      userId: input.userId,
      businessId: input.businessId,
      agentName: 'trend-scout',
      text: composeTopicScanText({
        topic: input.topic,
        platforms: input.platforms,
        count: input.count,
        kind: input.kind,
        brief,
      }),
      provider: input.run.provider,
      model: input.run.modelId,
      apiKey: input.run.apiKey,
      apiBaseUrl: input.run.apiBaseUrl,
      modelRuntime: input.run.runtime,
      systemContext: input.run.systemContext,
      toolContext: { userId: input.userId, businessId: input.businessId, event: input.event },
      log: input.log,
    })
    if (!scan.success) throw new Error(scan.error)
    const cards = await collectRunCards({ userId: input.userId, businessId: input.businessId, event: input.event }, new Date(Date.now()))
    return { cards, agentRunId: scan.data.runId, tokensUsed: scan.data.tokensUsed }
  }

  /**
   * Scout cards are already persisted by the board_add_cards tool — only
   * record the batch step on them. Re-inserting would duplicate every card.
   */
  private async recordScouted(
    input: TopicBatchExecution,
    cards: ContentItem[],
    agentRunId?: string,
  ): Promise<void> {
    for (const card of cards) {
      await contentBoardService.recordRun(input.userId, input.businessId, card.id, {
        step: `batch:${input.kind}`,
        agentRunId,
        status: 'completed',
      }, input.event)
    }
  }

  /** Stage 5 — persist plugin-generated cards and record the batch step. */
  private async persistFresh(
    input: TopicBatchExecution,
    cards: ContentCardInput[],
    agentRunId?: string,
  ): Promise<ServiceResponse<ContentItem[]>> {
    const added = await contentBoardService.addCards(input.userId, input.businessId, cards, {
      sourceType: 'trend',
      actorKind: 'agent',
      actorUserId: input.userId,
    }, input.event)
    if (!added.success) return added
    for (const card of added.data) {
      await contentBoardService.recordRun(input.userId, input.businessId, card.id, {
        step: `batch:${input.kind}`,
        agentRunId,
        status: 'completed',
      }, input.event)
    }
    return added
  }
}
