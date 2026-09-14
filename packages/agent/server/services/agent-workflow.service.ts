import type { H3Event } from 'h3'
import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import type { ContentCheck, ContentItem, ContentItemState } from '#layers/BaseDB/db/schema'
import type { AgentStreamEvent, AgentStreamEventListener } from '../agent/agent-events'
import { findPredefinedAgent } from '../agent/agents'
import { AGENT_PROMPTS, renderPrompt } from '../agent/prompts'
import { createAgentTools } from '../agent/tools'
import { createAgentToolContext, type AgentComplete } from '../agent/tool-context'
import { completeForUser, extractJsonObject, type RunConfig } from '../utils/run-config'
import { contentChainService, formatBriefWithSources, type ChainContext, type DraftOutput } from './content-chain.service'
import { agentRunnerService, type AgentRunInput, type AgentRunSummary } from './agent-runner.service'

export interface WorkflowRunInput extends AgentRunInput {
  event?: H3Event
}

export interface TrendScanResult {
  run: AgentRunSummary
  cards: ContentItem[]
}

export interface ResearchTaskInput {
  userId: string
  businessId: string
  topic: string
  run: RunConfig
  event?: H3Event
  onEvent?: AgentStreamEventListener
}

export interface ResearchTaskResult {
  brief: string
  citations: Array<{ label: string, url?: string }>
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

const IdeaScanSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().min(1).max(140),
    brief: z.string().max(500).default(''),
    platforms: z.array(z.string().min(1).max(40)).max(12).default([]),
  })).min(10).max(20),
})

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

function createChainEmitter(itemId: string, listener?: AgentStreamEventListener) {
  let seq = 0
  return (type: 'artifact.created' | 'review.required', artifactId: string) => {
    seq += 1
    void listener?.({ type, id: `${itemId}:${seq}`, artifactId } as AgentStreamEvent)
  }
}

export class AgentWorkflowService {
  async runTrendScan(input: WorkflowRunInput, onEvent: AgentStreamEventListener): Promise<ServiceResponse<TrendScanResult>> {
    const startedAt = new Date()
    const result = await agentRunnerService.run({ ...input, text: AGENT_PROMPTS.trendScan }, onEvent)
    if (!result.success) return { success: false, error: result.error, code: result.code }

    const cards = await this.collectRunCards(input, startedAt)
    for (const card of cards) {
      await contentBoardService.recordRun(input.userId, input.businessId, card.id, {
        step: 'trend_scan',
        agentRunId: result.data.runId,
        status: 'completed',
      })
    }
    return { success: true, data: { run: result.data, cards } }
  }

  /**
   * Content chain: research → write → humanize → checks → review. A card in
   * changes_requested resumes at drafting. Nothing is scheduled or published.
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
    if (!['idea', 'researching'].includes(card.state)) {
      return { success: true, data: { brief: card.brief || card.title } }
    }
    const started = await this.ensureState(input, card.state, 'researching')
    if (!started.success) return { success: false, error: started.error, code: started.code }

    const research = await this.step(input, 'research_topic', () => this.researchBrief(input, `${card.title}. ${card.brief ?? ''}`.trim()))
    if (!research.success) return { success: false, error: research.error, code: research.code }

    const ready = await this.ensureState(input, 'researching', 'research_ready')
    if (!ready.success) return { success: false, error: ready.error, code: ready.code }
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
    const viaAgent = await this.runResearchAgent(input)
    if (viaAgent) return { success: true, data: viaAgent }
    return this.researchFallback(input)
  }

  private async runResearchAgent(input: ResearchTaskInput): Promise<ResearchTaskResult | null> {
    const agent = findPredefinedAgent('researcher')
    if (!agent) return null
    const toolContext = createAgentToolContext({
      userId: input.userId,
      businessId: input.businessId,
      event: input.event,
      emit: input.onEvent ?? (() => {}),
      complete: input.run.complete,
      modelRuntime: input.run.runtime,
      model: input.run.model,
    })
    const tools = createAgentTools(toolContext).filter(tool => agent.tools.includes(tool.name))
    toolContext.subagentTools = tools

    const result = await agentRunnerService.runTask({
      userId: input.userId,
      businessId: input.businessId,
      agentName: agent.name,
      text: `Research this topic and return the strict JSON brief: ${input.topic}`,
      provider: input.run.provider,
      model: input.run.modelId,
      apiKey: input.run.apiKey,
      apiBaseUrl: input.run.apiBaseUrl,
      modelRuntime: input.run.runtime,
      systemContext: input.run.systemContext,
      toolContext: { userId: input.userId, businessId: input.businessId, event: input.event },
    }, input.onEvent)
    if (!result.success) return null

    const parsed = AgentResearchOutputSchema.safeParse(extractJsonObject(result.data.content))
    if (!parsed.success) return null
    const citations = normalizeAgentCitations(parsed.data.citations)
    return {
      brief: formatBriefWithSources(parsed.data.brief, citations),
      citations,
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
    return {
      success: true,
      data: {
        brief: result.data.brief,
        citations: result.data.citations,
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

  /** Quick actions: batch-create idea cards (never published). */
  async runBoardBatch(input: {
    userId: string
    businessId: string
    kind: 'days' | 'carousel' | 'reel' | 'repurpose'
    days?: number
    count?: number
    platforms?: string[]
    topic?: string
    event?: H3Event
  }): Promise<ServiceResponse<ContentItem[]>> {
    const requested = input.kind === 'days' ? (input.days ?? 7) : (input.count ?? 3)
    const count = Math.min(Math.max(requested, 1), 31)
    const label = input.kind === 'days' ? 'Post' : input.kind === 'carousel' ? 'Carousel' : input.kind === 'reel' ? 'Reel' : 'Repurpose'
    const cards = Array.from({ length: count }, (_, index) => ({
      title: input.topic ? `${input.topic} ${index + 1}` : `${label} ${index + 1}`,
      brief: input.topic ?? '',
      platforms: input.platforms ?? [],
    }))
    const sourceType = input.kind === 'repurpose' ? 'repurpose' : input.kind === 'days' ? 'manual' : 'template'
    const added = await contentBoardService.addCards(input.userId, input.businessId, cards, {
      sourceType,
      actorKind: 'user',
      actorUserId: input.userId,
    }, input.event)
    if (!added.success) return added
    for (const card of added.data) {
      await contentBoardService.recordRun(input.userId, input.businessId, card.id, {
        step: `batch:${input.kind}`,
        status: 'completed',
      }, input.event)
    }
    return { success: true, data: added.data }
  }

  /**
   * First-visit idea scan: one-shot LLM pass grounded in the business
   * context (profile, corpus, playbook) producing 10-20 trend-angled idea
   * cards. Lighter than runTrendScan (no agent loop, no platform signals).
   */
  async runIdeaScan(input: {
    userId: string
    businessId: string
    count?: number
    event?: H3Event
  }): Promise<ServiceResponse<ContentItem[]>> {
    const count = Math.min(Math.max(input.count ?? 15, 10), 20)
    const completed = await completeForUser(input.userId, {
      businessId: input.businessId,
      useBusinessContext: true,
      event: input.event,
      maxTokens: 2400,
      prompt: renderPrompt('ideaScan', { count: String(count) }),
    })
    if (!completed.success) return { success: false, error: completed.error, code: completed.code }
    const parsed = IdeaScanSchema.safeParse(completed.data.json)
    if (!parsed.success) return { success: false, error: 'AI idea scan returned no usable ideas', code: 'AI_PARSE_FAILED' }
    const added = await contentBoardService.addCards(input.userId, input.businessId, parsed.data.ideas, {
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
    return { success: true, data: added.data }
  }

  private async collectRunCards(input: WorkflowRunInput, startedAt: Date): Promise<ContentItem[]> {    const listed = await contentBoardService.list(input.userId, input.businessId, { state: 'idea' }, input.event)
    if (!listed.success) return []
    const cutoff = startedAt.getTime() - 1000
    return listed.data.filter(card =>
      card.createdBy === 'agent'
      && card.sourceType === 'trend'
      && new Date(card.createdAt).getTime() >= cutoff,
    )
  }
}

export const agentWorkflowService = new AgentWorkflowService()
