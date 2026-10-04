import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import type { ContentCheck, ContentItem, ContentItemState } from '#layers/BaseDB/db/schema'
import type { AgentStreamEvent, AgentStreamEventListener } from '../agent/agent-events'
import { findSpecialistProfile } from '../flue/specialists'
import type { AgentComplete } from '../agent/tool-context'
import { extractJsonObject, type RunConfig } from '../utils/run-config'
import { buildCapabilityRunContext } from '../capabilities/run-context'
import { runCapability } from '../capabilities'
import { contentChainService, formatBriefWithSources, type ChainContext, type DraftOutput } from './content-chain.service'
import { carouselWorkflowService } from './carousel-workflow.service'
import { agentRunnerService } from './agent-runner.service'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import {
  TopicBatchPipeline,
  type TopicBatchExecution,
  type TopicBatchInput,
} from './topic-batch.pipeline'

export interface ResearchTaskInput {
  userId: string
  businessId: string
  topic: string
  run: RunConfig
  event?: H3Event
  onEvent?: AgentStreamEventListener
  log?: RequestLogger
}

export interface ResearchTaskResult {
  brief: string
  citations: Array<{ label: string, url?: string }>
  keyFacts: string[]
  sourcesUsed: number
  usedAgent: boolean
  agentRunId?: string
}

const AgentCitationSchema = z.union([
  z.string(),
  z.object({ label: z.string().optional(), url: z.string().optional() }),
])

const AgentResearchOutputSchema = z.object({
  brief: z.string().min(1),
  citations: z.array(AgentCitationSchema).optional(),
  keyFacts: z.array(z.string()).optional(),
})

function normalizeAgentCitations(value: unknown): Array<{ label: string, url?: string }> {
  const parsed = z.array(AgentCitationSchema).safeParse(value)
  if (!parsed.success) return []
  const citations: Array<{ label: string, url?: string }> = []
  for (const entry of parsed.data) {
    if (typeof entry === 'string') citations.push({ label: entry })
    else if (entry.url) citations.push(entry.label ? { label: entry.label, url: entry.url } : { label: entry.url, url: entry.url })
  }
  return citations
}

/** Coded error code preserved across the capability boundary (else a generic failure). */
function errorCodeOf(error: unknown): string {
  return typeof (error as { code?: unknown } | null)?.code === 'string'
    ? (error as { code: string }).code
    : 'CAPABILITY_FAILED'
}

export interface ContentChainInput {
  userId: string
  businessId: string
  itemId: string
  complete: AgentComplete
  systemContext?: string | null
  event?: H3Event
  /** Full run config enables agent-first research; without it the service fallback runs. */
  run?: RunConfig
}

export interface ContentChainResult {
  artifactId: string
  item: ContentItem
  checks: ContentCheck[]
  draft: DraftOutput
  claimsPreserved: boolean
}

export interface CarouselChainResult {
  artifactId: string
  item: ContentItem
  slideCount: number
  caption: string
}

const BRIEF_SLIDE_COUNT = /(\d+)\s*-?\s*slide/i
const DEFAULT_SLIDE_COUNT = 6
const MAX_SLIDE_COUNT = 10

/** Slide count for a carousel card: "A 6-slide carousel" in the brief, else 6. */
export function carouselSlideCount(brief: string | null | undefined): number {
  const match = BRIEF_SLIDE_COUNT.exec(brief ?? '')
  const wanted = match ? Number(match[1]) : DEFAULT_SLIDE_COUNT
  return Number.isFinite(wanted) ? Math.min(Math.max(wanted, 2), MAX_SLIDE_COUNT) : DEFAULT_SLIDE_COUNT
}

function createChainEmitter(itemId: string, listener?: AgentStreamEventListener) {
  let seq = 0
  return (type: 'artifact.created' | 'review.required', artifactId: string) => {
    seq += 1
    void listener?.({ type, id: `${itemId}:${seq}`, artifactId } as AgentStreamEvent)
  }
}

export class AgentWorkflowService {
  /**
   * Content chain: research → write → humanize → checks → review. A card in
   * review_required resumes at drafting. Nothing is scheduled or published.
   */
  async runContentChain(
    input: ContentChainInput,
    onEvent?: AgentStreamEventListener,
  ): Promise<ServiceResponse<ContentChainResult>> {
    const card = await contentBoardService.get(input.userId, input.businessId, input.itemId, input.event)
    if (!card.success) return { success: false, error: card.error, code: card.code }

    const ctx: ChainContext = {
      userId: input.userId,
      businessId: input.businessId,
      complete: input.complete,
      brandContext: input.systemContext,
      event: input.event,
    }
    const emit = createChainEmitter(input.itemId, onEvent)
    const built = await this.buildDraft(input, card.data, ctx)
    if (!built.success) return { success: false, error: built.error, code: built.code }

    const checks = await this.step(input, 'checks', () => contentChainService.runChecks(ctx, {
      itemId: input.itemId,
      draft: built.data.draft,
      topic: card.data.title,
    }))
    if (!checks.success) return { success: false, error: checks.error, code: checks.code }

    const review = await this.step(input, 'review', async () => {
      const submitted = await contentChainService.submitForReview(ctx, {
        itemId: input.itemId,
        draft: built.data.draft,
      })
      if (!submitted.success) return submitted
      const moved = await contentBoardService.move(
        input.userId,
        input.businessId,
        input.itemId,
        'review_required',
        { actorKind: 'agent' },
        input.event,
      )
      if (!moved.success) return { success: false as const, error: moved.error, code: moved.code }
      emit('artifact.created', submitted.data.artifactId)
      emit('review.required', submitted.data.artifactId)
      return { success: true as const, data: { artifactId: submitted.data.artifactId, item: moved.data.item } }
    })
    if (!review.success) return { success: false, error: review.error, code: review.code }

    return {
      success: true,
      data: {
        artifactId: review.data.artifactId,
        item: review.data.item,
        checks: checks.data,
        draft: built.data.draft,
        claimsPreserved: built.data.claimsPreserved,
      },
    }
  }

  /**
   * Carousel chain for cards whose format is `carousel`: research → generate
   * slides → review. The carousel workflow owns research and generation; this
   * links the resulting carousel artifact to the card and parks it in
   * `review_required`, so the same approve/materialize gate as a post applies.
   */
  async runCarouselChain(input: ContentChainInput): Promise<ServiceResponse<CarouselChainResult>> {
    const card = await contentBoardService.get(input.userId, input.businessId, input.itemId, input.event)
    if (!card.success) return { success: false, error: card.error, code: card.code }

    const drafting = await this.ensureState(input, card.data.state, 'drafting')
    if (!drafting.success) return { success: false, error: drafting.error, code: drafting.code }

    const request = `${card.data.title}. ${card.data.brief ?? ''}`.trim()
    const slides = await this.step(input, 'generate_carousel', () => carouselWorkflowService.run(
      {
        userId: input.userId,
        businessId: input.businessId,
        complete: input.complete,
        brandContext: input.systemContext,
        event: input.event,
      },
      {
        request,
        slideCount: carouselSlideCount(card.data.brief),
        platform: (card.data.platforms ?? [])[0] ?? 'instagram',
      },
    ))
    if (!slides.success) return { success: false, error: slides.error, code: slides.code }

    const linked = await contentBoardService.linkArtifact(input.userId, input.businessId, input.itemId, slides.data.artifactId, input.event)
    if (!linked.success) return { success: false, error: linked.error, code: linked.code }

    const moved = await contentBoardService.move(input.userId, input.businessId, input.itemId, 'review_required', { actorKind: 'agent' }, input.event)
    if (!moved.success) return { success: false, error: moved.error, code: moved.code }

    return {
      success: true,
      data: {
        artifactId: slides.data.artifactId,
        item: moved.data.item,
        slideCount: slides.data.slideCount,
        caption: slides.data.caption,
      },
    }
  }

  private async buildDraft(
    input: ContentChainInput,
    card: ContentItem,
    ctx: ChainContext,
  ): Promise<ServiceResponse<{ draft: DraftOutput, claimsPreserved: boolean }>> {
    const brief = await this.prepareBrief(input, card, ctx)
    if (!brief.success) return { success: false, error: brief.error, code: brief.code }

    const drafting = await this.ensureState(input, card.state, 'drafting')
    if (!drafting.success) return { success: false, error: drafting.error, code: drafting.code }

    const platforms = (card.platforms ?? []) as string[]
    const written = await this.step(input, 'write_post', () => contentChainService.writePost(ctx, {
      brief: brief.data.brief,
      platforms,
    }))
    if (!written.success) return { success: false, error: written.error, code: written.code }

    const humanized = await this.step(input, 'humanize', () => contentChainService.humanize(ctx, {
      draft: written.data,
    }))
    if (!humanized.success) return { success: false, error: humanized.error, code: humanized.code }

    return { success: true, data: { draft: humanized.data.draft, claimsPreserved: humanized.data.claimsPreserved } }
  }

  private async prepareBrief(
    input: ContentChainInput,
    card: ContentItem,
    ctx: ChainContext,
  ): Promise<ServiceResponse<{ brief: string }>> {
    if (card.state !== 'idea') {
      return { success: true, data: { brief: card.brief || card.title } }
    }
    const research = await this.step(input, 'research_topic', () => this.researchBrief(input, `${card.title}. ${card.brief ?? ''}`.trim()))
    if (!research.success) return { success: false, error: research.error, code: research.code }
    return { success: true, data: { brief: research.data.brief } }
  }

  /** Agent-first research when a run config is present; service fallback otherwise. */
  private async researchBrief(input: ContentChainInput, topic: string): Promise<ServiceResponse<{ brief: string }>> {
    if (input.run) {
      const task = await this.runResearchTask({
        userId: input.userId,
        businessId: input.businessId,
        topic,
        run: input.run,
        event: input.event,
      })
      return task.success
        ? { success: true, data: { brief: task.data.brief } }
        : { success: false, error: task.error, code: task.code }
    }
    const ctx: ChainContext = {
      userId: input.userId,
      businessId: input.businessId,
      complete: input.complete,
      brandContext: input.systemContext,
      event: input.event,
    }
    const fallback = await contentChainService.researchWithWeb(ctx, { topic })
    return fallback.success
      ? { success: true, data: { brief: fallback.data.brief } }
      : { success: false, error: fallback.error, code: fallback.code }
  }

  /**
   * Run the predefined researcher agent (LangSearch skill + web_search tool)
   * and validate its strict JSON. Falls back to the service-level research
   * path when the agent fails or returns unparsable output, so a card never
   * dead-ends on one flaky turn.
   */
  async runResearchTask(input: ResearchTaskInput): Promise<ServiceResponse<ResearchTaskResult>> {
    emitLog(input.log, { message: 'research.started', topic: input.topic.slice(0, 200) })
    const viaAgent = await this.runResearchAgent(input)
    if (viaAgent) {
      emitLog(input.log, { message: 'research.agent.completed', sourcesUsed: viaAgent.sourcesUsed, agentRunId: viaAgent.agentRunId })
      return { success: true, data: viaAgent }
    }
    emitLog(input.log, { message: 'research.agent.unavailable', fallback: 'service' })
    return this.researchFallback(input)
  }

  private async runResearchAgent(input: ResearchTaskInput): Promise<ResearchTaskResult | null> {
    const agent = findSpecialistProfile('research-agent')
    if (!agent) return null
    const result = await agentRunnerService.runTask({
      userId: input.userId,
      businessId: input.businessId,
      agentName: agent.name,
      text: `Research this topic and return the strict JSON brief: ${input.topic}`,
      provider: input.run.provider,
      model: input.run.modelId,
      apiKey: input.run.apiKey,
      apiBaseUrl: input.run.apiBaseUrl,
      systemContext: input.run.systemContext,
      toolContext: { userId: input.userId, businessId: input.businessId, event: input.event },
      log: input.log,
    }, input.onEvent)
    if (!result.success) return null

    const parsed = AgentResearchOutputSchema.safeParse(extractJsonObject(result.data.content))
    if (!parsed.success) return null
    const citations = normalizeAgentCitations(parsed.data.citations)
    return {
      brief: formatBriefWithSources(parsed.data.brief, citations),
      citations,
      keyFacts: parsed.data.keyFacts ?? [],
      sourcesUsed: citations.length,
      usedAgent: true,
      agentRunId: result.data.runId,
    }
  }

  private async researchFallback(input: ResearchTaskInput): Promise<ServiceResponse<ResearchTaskResult>> {
    const ctx: ChainContext = {
      userId: input.userId,
      businessId: input.businessId,
      complete: input.run.complete,
      brandContext: input.run.systemContext,
      event: input.event,
    }
    const result = await contentChainService.researchWithWeb(ctx, { topic: input.topic })
    if (!result.success) return { success: false, error: result.error, code: result.code }
    emitLog(input.log, { message: 'research.fallback.completed', sourcesUsed: result.data.sourcesUsed })
    return {
      success: true,
      data: {
        brief: result.data.brief,
        citations: result.data.citations,
        keyFacts: [],
        sourcesUsed: result.data.sourcesUsed,
        usedAgent: false,
      },
    }
  }

  private async ensureState(
    input: ContentChainInput,
    current: string,
    target: ContentItemState,
  ): Promise<{ success: boolean, error?: string, code?: string }> {
    if (current === target) return { success: true }
    const moved = await contentBoardService.move(
      input.userId,
      input.businessId,
      input.itemId,
      target,
      { actorKind: 'agent' },
      input.event,
    )
    return moved.success ? { success: true } : { success: false, error: moved.error, code: moved.code }
  }

  private async step<T>(
    input: ContentChainInput,
    step: string,
    run: () => Promise<ServiceResponse<T>>,
  ): Promise<ServiceResponse<T>> {
    const result = await run()
    await contentBoardService.recordRun(input.userId, input.businessId, input.itemId, {
      step,
      status: result.success ? 'completed' : 'failed',
      error: result.success ? null : result.error,
    }, input.event)
    return result
  }

  /**
   * Topic batch pipeline (research → trend scan → platform-tailored ideas).
   * The flow lives in TopicBatchPipeline so it reads start-to-end in one
   * place; these methods preserve the service surface (routes, tools, tests).
   */
  private batches = new TopicBatchPipeline({ research: input => this.runResearchTask(input) })

  async startTopicBatch(input: TopicBatchInput): Promise<ServiceResponse<{ runId: string, count: number }>> {
    return this.batches.start(input)
  }

  async executeTopicBatch(input: TopicBatchExecution): Promise<void> {
    return this.batches.execute(input)
  }

  /**
   * First-visit idea scan: one-shot LLM pass grounded in the business
   * context (profile, corpus, playbook) producing 10-20 trend-angled idea
   * cards. Lighter than a full trend-scout agent run (no agent loop, no platform signals).
   */
  async runIdeaScan(input: {
    userId: string
    businessId: string
    count?: number
    event?: H3Event
    log?: RequestLogger
  }): Promise<ServiceResponse<ContentItem[]>> {
    const count = Math.min(Math.max(input.count ?? 15, 10), 20)
    emitLog(input.log, { message: 'idea-scan.started', count })
    let runCtx
    try {
      runCtx = await buildCapabilityRunContext(input.userId, input.businessId, {
        useBusinessContext: true,
        event: input.event,
        log: input.log,
        capability: 'workflow.idea_scan',
      })
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Idea scan failed', code: errorCodeOf(error) }
    }
    const outcome = await runCapability('workflow.idea_scan', { count }, runCtx)
    if (!outcome.ok) return { success: false, error: outcome.error, code: outcome.code }
    const added = await contentBoardService.addCards(input.userId, input.businessId, outcome.output.ideas, {
      sourceType: 'trend',
      actorKind: 'agent',
      actorUserId: input.userId,
    }, input.event)
    if (!added.success) return added
    for (const card of added.data) {
      await contentBoardService.recordRun(input.userId, input.businessId, card.id, {
        step: 'idea_scan',
        status: 'completed',
      }, input.event)
    }
    emitLog(input.log, { message: 'idea-scan.completed', created: added.data.length })
    return { success: true, data: added.data }
  }

}

export const agentWorkflowService = new AgentWorkflowService()
