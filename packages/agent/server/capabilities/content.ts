import { z } from 'zod'
import type { ContentCheck, ContentItem, ContentItemState, PublishConnection } from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import {
  contentChainService,
  storedVariantBodies,
  storedVariants,
  type ChainContext,
  type DraftOutput,
  type VariantOutput,
} from '../services/content-chain.service'
import {
  createContentIntelligence,
  dedupeIdeas,
  loadIdeaBusinessContext,
  normalizeBrief,
  normalizeIdeaTitle,
  sanitizeBrief,
  type GenerateIdeasRequest,
  type IdeaBusinessContext,
  type ResearchCallResult,
} from '../content-intelligence'
import type { RunConfig } from '../utils/run-config'
import { extractJsonObject } from '../utils/run-config'
import { capabilityRegistry, type Capability, type CapabilityRunContext } from './registry'

const PlatformListSchema = z.array(z.string().min(1).max(40)).max(12)
const PlatformsSchema = PlatformListSchema.default([])
const SourceSchema = z.object({ label: z.string(), url: z.string().optional() })

const MAX_SCAN_COUNT = 10
/** How many of the business's cards a rescan compares titles against before creating new ones. */
const SCAN_DEDUPE_LIMIT = 500
const SCAN_PLATFORM_FALLBACK = 'facebook'
const BUSINESS_SCAN_TOPIC = 'What this business should publish next, and why its customers care'
/** A platform body is markdown; this is a generous ceiling well above any article. */
const MAX_VARIANT_BODY = 60000

const ScanInputSchema = z.object({
  /** Omit to scan the business itself instead of a topic. */
  topic: z.string().min(1).max(300).optional(),
  platforms: PlatformsSchema,
  count: z.number().int().default(6),
})

/**
 * `itemId` is the Planned card the idea landed on — created by the scan, or
 * reused when this business already had a card with that title. Absent only
 * when the card could not be created; the idea is still returned.
 */
const ScanOutputSchema = z.object({
  ideas: z.array(z.object({
    id: z.string(),
    title: z.string(),
    brief: z.string(),
    platforms: z.array(z.string()),
    itemId: z.string().optional(),
  })),
  sources: z.array(SourceSchema),
})

/** The card row an owner-facing mutation returns. Extra columns pass through. */
const ContentItemOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  brief: z.string().catch(''),
  state: z.string(),
  format: z.string().catch('social_post'),
  platforms: z.array(z.string()).catch([]),
  priority: z.number().catch(0),
  artifactId: z.string().nullable().catch(null),
  postId: z.string().nullable().catch(null),
}).passthrough()

/** A stored quality check row, as the item page renders it. */
const StoredCheckSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  score: z.number().nullable().catch(null),
  findings: z.unknown().optional(),
}).passthrough()

/** The intelligence module consumes the wider RunConfig shape; a capability run carries only the completion. */
function runConfigFor(ctx: CapabilityRunContext): RunConfig {
  const partial: Partial<RunConfig> = {
    runtime: null,
    model: null,
    provider: '',
    modelId: '',
    apiKey: null,
    apiBaseUrl: null,
    systemContext: ctx.systemContext,
    complete: ctx.complete,
  }
  return partial as RunConfig
}

function researchCall(ctx: CapabilityRunContext) {
  return async (input: { userId: string, businessId: string, topic: string, run: RunConfig }): Promise<ServiceResponse<ResearchCallResult>> => {
    const result = await contentChainService.researchWithWeb({
      userId: input.userId,
      businessId: input.businessId,
      complete: ctx.complete,
      brandContext: ctx.systemContext,
      event: ctx.event,
    }, { topic: input.topic })
    if (!result.success) return { success: false, error: result.error, code: result.code ?? 'RESEARCH_FAILED' }
    return {
      success: true,
      data: {
        // The research model answers with an envelope whenever it feels like
        // it. Passing `brief` straight through is what put raw JSON on board
        // cards (PRD §10.1.4): the brief is prose or it is nothing.
        brief: sanitizeBrief(result.data.brief),
        citations: result.data.citations,
        sourcesUsed: result.data.sourcesUsed,
        usedAgent: true,
      },
    }
  }
}

function intelligenceFor(ctx: CapabilityRunContext, business: IdeaBusinessContext | null) {
  return createContentIntelligence({
    research: researchCall(ctx),
    complete: ctx.complete,
    loadBusiness: async () => business,
  })
}

function clampCount(count: number): number {
  return Math.min(Math.max(count, 1), MAX_SCAN_COUNT)
}

/** Topic seed for a business-wide scan, so the research call has something concrete to search. */
function businessScanTopic(business: IdeaBusinessContext | null): string {
  const parts = [business?.name, business?.industry, business?.description]
    .filter((part): part is string => Boolean(part))
  return (parts.join(' — ') || BUSINESS_SCAN_TOPIC).slice(0, 300)
}

function scanIdea(idea: { title: string, brief: string, platforms: string[] }) {
  return {
    id: normalizeIdeaTitle(idea.title),
    title: idea.title,
    brief: sanitizeBrief(idea.brief),
    platforms: idea.platforms,
  }
}

/** Normalized-title index of this business's cards, so a rescan reuses them. */
async function existingCardIndex(ctx: CapabilityRunContext): Promise<Map<string, ContentItem>> {
  const index = new Map<string, ContentItem>()
  const listed = await contentBoardService.list(ctx.userId, ctx.businessId, { limit: SCAN_DEDUPE_LIMIT }, ctx.event)
  if (!listed.success) return index
  for (const item of listed.data) index.set(normalizeIdeaTitle(item.title), item)
  return index
}

/**
 * Persist one scanned idea as a Planned card. A card this business already has
 * for that title is reused and its id returned instead — a rescan must not
 * flood the board with copies of the same ideas.
 */
async function planCard(
  idea: { title: string, brief: string, platforms: string[] },
  index: Map<string, ContentItem>,
  ctx: CapabilityRunContext,
): Promise<string | null> {
  const key = normalizeIdeaTitle(idea.title)
  const existing = index.get(key)
  if (existing) return existing.id
  const created = await contentBoardService.create(ctx.userId, ctx.businessId, {
    title: idea.title,
    brief: idea.brief,
    platforms: idea.platforms,
    createdBy: 'agent',
    createdByUserId: ctx.userId,
  }, ctx.event)
  if (!created.success) {
    emitLog(ctx.log, { message: 'content.scan.card_not_planned', title: idea.title, error: created.error ?? 'unknown' })
    return null
  }
  index.set(key, created.data)
  return created.data.id
}

async function planScannedIdeas(
  ideas: Array<{ title: string, brief: string, platforms: string[] }>,
  ctx: CapabilityRunContext,
) {
  const index = await existingCardIndex(ctx)
  return Promise.all(ideas.map(async (idea) => {
    const card = scanIdea(idea)
    const itemId = await planCard(card, index, ctx)
    return { ...card, itemId: itemId ?? undefined }
  }))
}

async function runScan(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = ScanInputSchema.parse(rawInput)
  const business = await loadIdeaBusinessContext({ userId: ctx.userId, businessId: ctx.businessId, event: ctx.event })
  const request: GenerateIdeasRequest = {
    userId: ctx.userId,
    businessId: ctx.businessId,
    topic: input.topic ?? businessScanTopic(business),
    quantity: clampCount(input.count),
    platforms: input.platforms.length > 0 ? input.platforms : [SCAN_PLATFORM_FALLBACK],
    run: runConfigFor(ctx),
    event: ctx.event,
    log: ctx.log,
  }
  const generated = await intelligenceFor(ctx, business).generateContentIdeas(request)
  if (!generated.success) return { success: false as const, error: generated.error, code: generated.code }
  return {
    success: true as const,
    data: {
      ideas: await planScannedIdeas(dedupeIdeas(generated.data.ideas), ctx),
      sources: generated.data.research.sources,
    },
  }
}

const DraftSchema = z.object({
  caption: z.string(),
  platformVariants: z.record(z.string(), z.string()),
  slideCopy: z.array(z.string()),
  cta: z.string(),
  claims: z.array(z.string()),
  sources: z.array(SourceSchema),
})

const WriteInputSchema = z.object({
  idea: z.object({
    id: z.string().min(1).max(200).optional(),
    title: z.string().min(1).max(200),
    /** An empty brief is fine — the research step is what fills it in. */
    brief: z.string().max(10000).optional(),
  }).optional(),
  /** Legacy flat payload — still accepted so the MCP tool keeps working. */
  title: z.string().min(1).max(200).optional(),
  brief: z.string().min(1).max(10000).optional(),
  topic: z.string().min(1).max(300).optional(),
  /** Target keyword the SEO/GEO platform body is grounded in. */
  keyword: z.string().max(200).optional(),
  platforms: PlatformsSchema,
  itemId: z.string().min(1).optional(),
  /**
   * Where the card stops. `review_required` (the default) is the four-step
   * flow; `drafting` runs the same chain and leaves the card in Writing for a
   * human to look at before it is self-reviewed.
   */
  stopAt: z.enum(['drafting', 'review_required']).default('review_required'),
}).refine(input => Boolean(input.idea ?? input.title), { message: 'An idea with a title, or a title, is required' })

const WriteOutputSchema = z.object({
  itemId: z.string(),
  artifactId: z.string(),
  article: z.string(),
  draft: DraftSchema,
  checks: z.array(z.unknown()),
})

type WriteInput = z.infer<typeof WriteInputSchema>
type WriteStopAt = WriteInput['stopAt']

function writeTitle(input: WriteInput): string {
  return input.idea?.title ?? input.title ?? ''
}

function writeBrief(input: WriteInput): string {
  return input.idea?.brief ?? input.brief ?? ''
}

/** Research query: the scan topic when the caller kept it, else the idea itself. */
function writeTopic(input: WriteInput): string {
  return input.topic ?? writeTitle(input)
}

function writeContext(ctx: CapabilityRunContext): ChainContext {
  return {
    userId: ctx.userId,
    businessId: ctx.businessId,
    complete: ctx.complete,
    brandContext: ctx.systemContext,
    event: ctx.event,
  }
}

async function researchBrief(chainContext: ChainContext, input: WriteInput): Promise<ServiceResponse<string>> {
  const research = await contentChainService.researchWithWeb(chainContext, { topic: writeTopic(input) })
  if (!research.success) return { success: false, error: research.error, code: research.code }
  return { success: true, data: research.data.brief || writeBrief(input) }
}

/**
 * One body per selected target (PRD §10 D07). With no platform selected there
 * is a single `default` body, mirrored from the article so both agree.
 */
async function buildVariants(
  chainContext: ChainContext,
  input: { title: string, brief: string, article: string, platforms: string[], keyword?: string },
): Promise<ServiceResponse<Record<string, VariantOutput>>> {
  if (input.platforms.length === 0) {
    return { success: true, data: { default: { body: input.article, keywords: [], notes: '' } } }
  }
  return contentChainService.writeVariants(chainContext, input)
}

/** caption → long-form article → per-target bodies → humanize; the caption path is unchanged by the article steps. */
async function buildDraft(
  chainContext: ChainContext,
  input: { title: string, brief: string, platforms: string[], keyword?: string },
) {
  const written = await contentChainService.writePost(chainContext, { brief: input.brief, platforms: input.platforms })
  if (!written.success) return written
  const article = await contentChainService.writeArticle(chainContext, {
    title: input.title,
    brief: input.brief,
    platforms: input.platforms,
  })
  if (!article.success) return article
  const variants = await buildVariants(chainContext, {
    title: input.title,
    brief: input.brief,
    article: article.data.article,
    platforms: input.platforms,
    keyword: input.keyword,
  })
  if (!variants.success) return variants
  const humanized = await contentChainService.humanize(chainContext, {
    draft: {
      ...written.data,
      article: article.data.article,
      variants: variants.data,
      keyword: input.keyword ?? '',
    },
  })
  if (!humanized.success) return humanized
  return { success: true as const, data: humanized.data.draft }
}

/**
 * The artifact lands either way. `stopAt: 'drafting'` only skips the final
 * card move, so the board keeps the card in Writing with a saved article
 * instead of handing it straight to review.
 */
async function moveToReview(
  ctx: CapabilityRunContext,
  itemId: string,
  artifactId: string,
  stopAt: WriteStopAt,
): Promise<ServiceResponse<null>> {
  if (stopAt === 'drafting') return { success: true, data: null }
  const reviewed = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'review_required', {
    actorKind: 'agent',
    payload: { action: 'content.write', artifactId },
  }, ctx.event)
  if (!reviewed.success) {
    return { success: false, error: reviewed.error ?? 'Failed to submit the draft for review', code: reviewed.code ?? 'CAPABILITY_FAILED' }
  }
  return { success: true, data: null }
}

async function reviewDraft(
  chainContext: ChainContext,
  ctx: CapabilityRunContext,
  itemId: string,
  draft: DraftOutput,
  topic: string,
  stopAt: WriteStopAt,
) {
  const checks = await contentChainService.runChecks(chainContext, { itemId, draft, topic })
  if (!checks.success) return checks
  const submitted = await contentChainService.submitForReview(chainContext, { itemId, draft })
  if (!submitted.success) return submitted
  const reviewed = await moveToReview(ctx, itemId, submitted.data.artifactId, stopAt)
  if (!reviewed.success) return reviewed
  return { success: true as const, data: { artifactId: submitted.data.artifactId, checks: checks.data } }
}

async function resolveWriteItem(input: WriteInput, ctx: CapabilityRunContext) {
  if (!input.itemId) {
    return contentBoardService.create(ctx.userId, ctx.businessId, {
      title: writeTitle(input),
      brief: writeBrief(input),
      platforms: input.platforms,
      createdBy: 'agent',
      createdByUserId: ctx.userId,
    }, ctx.event)
  }
  return contentBoardService.get(ctx.userId, ctx.businessId, input.itemId, ctx.event)
}

async function moveToDrafting(item: ContentItem, ctx: CapabilityRunContext) {
  if (item.state === 'drafting') return { success: true as const, data: item }
  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, item.id, 'drafting', {
    actorKind: 'agent',
    payload: { action: 'content.write' },
  }, ctx.event)
  if (!moved.success) return moved
  return { success: true as const, data: moved.data.item }
}

async function completeWrite(input: WriteInput, item: ContentItem, ctx: CapabilityRunContext) {
  const chainContext = writeContext(ctx)
  const title = writeTitle(input)
  const brief = await researchBrief(chainContext, input)
  if (!brief.success) return brief
  const draft = await buildDraft(chainContext, {
    title,
    brief: brief.data,
    platforms: input.platforms,
    keyword: input.keyword,
  })
  if (!draft.success) return draft
  const reviewed = await reviewDraft(chainContext, ctx, item.id, draft.data, title, input.stopAt)
  if (!reviewed.success) return reviewed
  return {
    success: true as const,
    data: {
      itemId: item.id,
      artifactId: reviewed.data.artifactId,
      article: draft.data.article ?? '',
      draft: draft.data,
      checks: reviewed.data.checks,
    },
  }
}

async function runWrite(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = WriteInputSchema.parse(rawInput)
  const resolved = await resolveWriteItem(input, ctx)
  if (!resolved.success) return resolved
  const drafting = await moveToDrafting(resolved.data, ctx)
  if (!drafting.success) return drafting
  return completeWrite(input, drafting.data, ctx)
}

const PublishInputSchema = z.object({
  itemId: z.string().min(1),
  provider: z.enum(['github', 'wordpress']).default('wordpress'),
  /** Which of the business's publishing connections to deliver through; omit to use the provider's active one. */
  connectionId: z.string().min(1).optional(),
  targetAccountIds: z.array(z.string().min(1)).min(1).optional(),
  /** Safe Mode is the UI's two-step control; the second press sends this. */
  confirm: z.boolean().default(false),
})

const PublishOutputSchema = z.object({
  itemId: z.string(),
  artifactId: z.string(),
  jobId: z.string(),
  postId: z.string(),
  /** Which body went out: the platform's own variant, the shared article, or the caption. */
  variant: z.string(),
})

type PublishInput = z.infer<typeof PublishInputSchema>

interface PublishTarget {
  artifactId: string
  version: number
  output: string
}

function confirmationRequired() {
  return { success: false as const, error: 'Publishing requires an explicit confirmation', code: 'CONFIRMATION_REQUIRED' }
}

function storedRecord(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

function storedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function storedArticle(stored: Record<string, unknown>): string {
  return storedText(stored.article)
}

/**
 * The body a publishing target receives (PRD §10 D07 / §10.1.2): the variant
 * written for that target, else the shared article, else nothing — which leaves
 * the materialised caption in place. The returned `variant` names what was
 * chosen so the UI can say which version went out.
 */
function publishBodyOf(stored: Record<string, unknown>, provider: string): { body: string, variant: string } {
  const variant = storedVariantBodies(stored)[provider] ?? ''
  if (variant) return { body: variant, variant: provider }
  const article = storedArticle(stored)
  if (article) return { body: article, variant: 'article' }
  return { body: '', variant: 'caption' }
}

/**
 * Put the materialised post's delivery body in place: the variant written for
 * this provider, else the shared article, else nothing (which leaves the
 * materialised caption alone). WordPress/GitHub delivery never reaches a social
 * account — that is the separate `content.social.publish` action
 * (PRD §10.1.5) — and nothing here writes to a social account or sends a post.
 */
async function finalizePublishedPost(
  postId: string,
  output: string,
  provider: string,
  ctx: CapabilityRunContext,
): Promise<ServiceResponse<{ variant: string }>> {
  const selected = publishBodyOf(storedRecord(output), provider)
  if (!selected.body) return { success: true, data: { variant: selected.variant } }
  const updated = await postService.update(postId, ctx.userId, { content: selected.body })
  if (!updated.success) return { success: false, error: updated.error ?? 'Failed to publish the article body', code: 'PUBLISH_FAILED' }
  return { success: true, data: { variant: selected.variant } }
}

async function loadPublishTarget(input: PublishInput, ctx: CapabilityRunContext) {
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, input.itemId, ctx.event)
  if (!card.success) return card
  if (!card.data.artifactId) return { success: false as const, error: 'Content has no artifact to publish', code: 'ARTIFACT_REQUIRED' }
  const artifact = await contentArtifactService.getArtifact(ctx.userId, card.data.artifactId, ctx.businessId, ctx.event)
  if (!artifact.success) return artifact
  return {
    success: true as const,
    data: { artifactId: card.data.artifactId, version: artifact.data.version, output: artifact.data.output },
  }
}

/**
 * An explicitly chosen connection must belong to the business in the run
 * context and carry the requested provider, or the caller is asking to
 * deliver through a destination this business never chose. Ownership itself is
 * enforced by `getConnection` (`findOwned` resolves the caller's access to the
 * connection's business and compares the connection's owner), which is why no
 * second raw `userId` comparison is made here: connections are owned by the
 * business owner, not by whichever team member is clicking.
 */
function verifyPublishConnection(
  connection: PublishConnection,
  provider: PublishInput['provider'],
  businessId: string,
): { error: string, code: string } | null {
  if (connection.businessId !== businessId) return connectionMismatch('belongs to another business')
  if (connection.provider !== provider) return connectionMismatch(`is a ${connection.provider} connection`)
  if (!connection.isActive) return connectionMismatch('is not active')
  return null
}

function connectionMismatch(reason: string) {
  return { error: `The chosen publishing connection ${reason}`, code: 'PUBLISH_CONNECTION_MISMATCH' }
}

function connectionRequired() {
  return { success: false as const, error: 'No active publishing connection', code: 'PUBLISH_CONNECTION_REQUIRED' }
}

async function chosenConnection(
  connectionId: string,
  provider: PublishInput['provider'],
  ctx: CapabilityRunContext,
) {
  const found = await publishingService.getConnection(ctx.userId, connectionId, ctx.event)
  if (!found.success || !found.data) return connectionRequired()
  const mismatch = verifyPublishConnection(found.data, provider, ctx.businessId)
  if (mismatch) return { success: false as const, ...mismatch }
  return { success: true as const, data: found.data }
}

async function resolvePublishConnection(input: PublishInput, ctx: CapabilityRunContext) {
  if (input.connectionId) return chosenConnection(input.connectionId, input.provider, ctx)
  const active = await publishingService.getActiveConnection(ctx.userId, ctx.businessId, input.provider, ctx.event)
  if (!active.success || !active.data) return connectionRequired()
  return { success: true as const, data: active.data }
}

/**
 * The job is created before materialization on purpose: materializing flips the
 * artifact to `draft`, and `createJob` re-checks approval on that exact version.
 */
async function createPublishJob(input: PublishInput, target: PublishTarget, ctx: CapabilityRunContext) {
  const connection = await resolvePublishConnection(input, ctx)
  if (!connection.success) return connection
  const job = await publishingService.createJob(ctx.userId, {
    businessId: ctx.businessId,
    connectionId: connection.data.id,
    artifactId: target.artifactId,
    artifactVersion: target.version,
  }, ctx.event)
  if (!job.success) return job
  return { success: true as const, data: { jobId: job.data.job.id } }
}

async function materializeForPublish(input: PublishInput, target: PublishTarget, ctx: CapabilityRunContext) {
  const materialized = await contentArtifactService.materializeArtifact(ctx.userId, target.artifactId, ctx.businessId, ctx.event, input.targetAccountIds)
  if (!materialized.success) return materialized
  if (!materialized.data.postId) return { success: false as const, error: 'Materialization returned no post', code: 'PUBLISH_FAILED' }
  const body = await finalizePublishedPost(materialized.data.postId, target.output, input.provider, ctx)
  if (!body.success) return body
  return { success: true as const, data: { postId: materialized.data.postId, variant: body.data.variant } }
}

async function movePublished(itemId: string, jobId: string, ctx: CapabilityRunContext) {
  const payload = { action: 'content.publish', jobId }
  const scheduled = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'scheduled', {
    actorKind: 'user', actorUserId: ctx.userId, payload,
  }, ctx.event)
  if (!scheduled.success) return scheduled
  const published = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'published', {
    actorKind: 'user', actorUserId: ctx.userId, payload,
  }, ctx.event)
  if (!published.success) return published
  return { success: true as const, data: published.data.item }
}

async function publishConfirmed(input: PublishInput, ctx: CapabilityRunContext) {
  const target = await loadPublishTarget(input, ctx)
  if (!target.success) return target
  const job = await createPublishJob(input, target.data, ctx)
  if (!job.success) return job
  const post = await materializeForPublish(input, target.data, ctx)
  if (!post.success) return post
  const moved = await movePublished(input.itemId, job.data.jobId, ctx)
  if (!moved.success) return moved
  return {
    success: true as const,
    data: {
      itemId: input.itemId,
      artifactId: target.data.artifactId,
      jobId: job.data.jobId,
      postId: post.data.postId,
      variant: post.data.variant,
    },
  }
}

async function runPublish(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = PublishInputSchema.parse(rawInput)
  if (!input.confirm) return confirmationRequired()
  return publishConfirmed(input, ctx)
}

/**
 * The board's drag-and-drop input. Every legal destination of the state
 * machine is reachable; `failed` is not, because recovery from it is
 * `resetFailed`, not a drag.
 */
const MoveInputSchema = z.object({
  itemId: z.string().min(1),
  to: z.enum(['idea', 'drafting', 'review_required', 'scheduled', 'published', 'archived']),
})

const MoveOutputSchema = z.object({
  itemId: z.string(),
  state: z.string(),
})

/**
 * `contentBoardService.move` is the sole authority on transitions: this
 * capability only forwards the drop and reports the board's own coded failure
 * (`INVALID_TRANSITION`, `HUMAN_ACTION_REQUIRED`, `ARTIFACT_REQUIRED`) so the
 * board can toast it instead of silently snapping the card back.
 */
async function runMove(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = MoveInputSchema.parse(rawInput)
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, input.itemId, ctx.event)
  if (!card.success) return card
  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, input.itemId, input.to as ContentItemState, {
    actorKind: 'user',
    actorUserId: ctx.userId,
    payload: { action: 'content.move' },
  }, ctx.event)
  if (!moved.success) return moved
  return { success: true as const, data: { itemId: input.itemId, state: moved.data.item.state } }
}

/**
 * The card's three-dot menu: title, brief, platforms and priority are board
 * columns; `keyword` and `variant` live on the artifact. Only the fields the
 * owner sent are applied — `contentBoardService.update` keeps the rest.
 */
const VariantWriteSchema = z.object({
  platform: z.string().min(1).max(40),
  body: z.string().max(MAX_VARIANT_BODY),
})

const UpdateInputSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  brief: z.string().max(10000).optional(),
  platforms: PlatformListSchema.optional(),
  priority: z.number().int().min(-100).max(100).optional(),
  keyword: z.string().max(200).optional(),
  variant: VariantWriteSchema.optional(),
})

const UpdateOutputSchema = z.object({
  itemId: z.string(),
  state: z.string(),
  item: ContentItemOutputSchema,
})

function artifactRequired() {
  return { success: false as const, error: 'Content has no artifact yet', code: 'ARTIFACT_REQUIRED' }
}

/** The stored `variants` map reduced to contract-shaped entries, so one edit never breaks the artifact. */
function variantEntries(value: unknown): Record<string, VariantOutput> {
  const entries = isRecord(value) ? value : {}
  const map: Record<string, VariantOutput> = {}
  for (const [platform, entry] of Object.entries(entries)) {
    const row = isRecord(entry) ? entry : {}
    map[platform] = {
      body: typeof row.body === 'string' ? row.body : '',
      keywords: Array.isArray(row.keywords) ? row.keywords.filter(tag => typeof tag === 'string') : [],
      notes: typeof row.notes === 'string' ? row.notes : '',
    }
  }
  return map
}

/** One target's body swapped; its keywords and notes survive the edit. */
function withVariantBody(stored: Record<string, unknown>, platform: string, body: string): Record<string, unknown> {
  const variants = variantEntries(stored.variants)
  const previous = variants[platform]
  variants[platform] = { body, keywords: previous?.keywords ?? [], notes: previous?.notes ?? '' }
  return { ...stored, variants }
}

function updateOutput(input: z.infer<typeof UpdateInputSchema>, stored: Record<string, unknown>): Record<string, unknown> {
  const withBody = input.variant === undefined ? stored : withVariantBody(stored, input.variant.platform, input.variant.body)
  return input.keyword === undefined ? withBody : { ...withBody, keyword: input.keyword }
}

/** Persist the artifact-side half of an update: only `variants`/`keyword` change. */
async function writeArtifactPatch(card: ContentItem, input: z.infer<typeof UpdateInputSchema>, ctx: CapabilityRunContext) {
  if (input.variant === undefined && input.keyword === undefined) return { success: true as const, data: null }
  if (!card.artifactId) return artifactRequired()
  const current = await contentArtifactService.getArtifact(ctx.userId, card.artifactId, ctx.businessId, ctx.event)
  if (!current.success) return current
  const edited = await contentArtifactService.editArtifact(ctx.userId, card.artifactId, ctx.businessId, {
    version: current.data.version,
    output: updateOutput(input, storedRecord(current.data.output)),
  }, ctx.event)
  if (!edited.success) return edited
  return { success: true as const, data: null }
}

async function runUpdate(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = UpdateInputSchema.parse(rawInput)
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, input.itemId, ctx.event)
  if (!card.success) return card
  const updated = await contentBoardService.update(ctx.userId, ctx.businessId, input.itemId, {
    title: input.title,
    brief: input.brief === undefined ? undefined : normalizeBrief(input.brief),
    platforms: input.platforms,
    priority: input.priority,
  }, { actorKind: 'user', actorUserId: ctx.userId }, ctx.event)
  if (!updated.success) return updated
  const artifact = await writeArtifactPatch(card.data, input, ctx)
  if (!artifact.success) return artifact
  return { success: true as const, data: { itemId: input.itemId, state: updated.data.state, item: updated.data } }
}

const DeleteInputSchema = z.object({ itemId: z.string().min(1) })
const DeleteOutputSchema = z.object({ itemId: z.string(), deleted: z.literal(true) })

/** The artifact first: a delivered one refuses, so nothing is half-deleted. */
async function deleteArtifactOf(card: ContentItem, ctx: CapabilityRunContext) {
  if (!card.artifactId) return { success: true as const, data: null }
  const deleted = await contentArtifactService.deleteArtifact(ctx.userId, card.artifactId, ctx.businessId, ctx.event)
  if (!deleted.success) return deleted
  return { success: true as const, data: null }
}

async function runDelete(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = DeleteInputSchema.parse(rawInput)
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, input.itemId, ctx.event)
  if (!card.success) return card
  const artifact = await deleteArtifactOf(card.data, ctx)
  if (!artifact.success) return artifact
  const removed = await contentBoardService.remove(ctx.userId, ctx.businessId, input.itemId, ctx.event)
  if (!removed.success) return removed
  return { success: true as const, data: { itemId: input.itemId, deleted: true as const } }
}

/** A check the owner asks the agent to repair: kind, verdict, and the findings. */
const FixCheckSchema = z.object({
  kind: z.string().min(1).max(60),
  status: z.enum(['pass', 'warn', 'fail']),
  score: z.number().nullable().optional(),
  findings: z.unknown().optional(),
})

const FixInputSchema = z.object({
  itemId: z.string().min(1),
  /** Omit to repair against the checks already stored for this card. */
  checks: z.array(FixCheckSchema).max(20).optional(),
  keyword: z.string().max(200).optional(),
  topic: z.string().max(300).optional(),
  instructions: z.string().max(2000).optional(),
})

const FixOutputSchema = z.object({
  itemId: z.string(),
  artifactId: z.string(),
  article: z.string(),
  checks: z.array(StoredCheckSchema),
  changed: z.boolean(),
})

/** Only `warn` and `fail` are repair work; a `pass` is left alone. */
function failingChecks(checks: Array<{ status: string }>): Array<z.infer<typeof FixCheckSchema>> {
  return checks.filter(check => check.status !== 'pass') as Array<z.infer<typeof FixCheckSchema>>
}

function storedSources(stored: Record<string, unknown>): Array<{ label: string }> {
  const sources = Array.isArray(stored.sources) ? stored.sources : []
  return sources.filter((entry): entry is string => typeof entry === 'string').map(label => ({ label }))
}

/** The checked text is the article being repaired, so the new scores match what the owner sees. */
function checkDraft(target: FixTarget, article: string): DraftOutput {
  return {
    caption: article,
    // Carried as `article` as well: the checks score the article when there is
    // one, so the repaired body is scored by the article rules and the finding
    // says `measured: 'article'` — the truth about what was just repaired.
    article,
    platformVariants: storedVariantBodies(target.stored),
    slideCopy: [],
    cta: storedText(target.stored.cta),
    claims: [],
    sources: storedSources(target.stored),
  }
}

interface FixTarget {
  card: ContentItem
  artifactId: string
  version: number
  stored: Record<string, unknown>
  article: string
  checks: ContentCheck[]
}

async function loadFixArtifact(artifactId: string | null, ctx: CapabilityRunContext) {
  if (!artifactId) return artifactRequired()
  return contentArtifactService.getArtifact(ctx.userId, artifactId, ctx.businessId, ctx.event)
}

async function withStoredChecks(target: Omit<FixTarget, 'checks'>, itemId: string, ctx: CapabilityRunContext) {
  const listed = await contentBoardService.listChecks(ctx.userId, ctx.businessId, itemId, ctx.event)
  return { success: true as const, data: { ...target, checks: listed.success ? listed.data : [] } }
}

async function loadFixTarget(itemId: string, ctx: CapabilityRunContext) {
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, itemId, ctx.event)
  if (!card.success) return card
  const artifact = await loadFixArtifact(card.data.artifactId, ctx)
  if (!artifact.success) return artifact
  const stored = storedRecord(artifact.data.output)
  const article = storedArticle(stored)
  if (!article) return artifactRequired()
  return withStoredChecks({ card: card.data, artifactId: card.data.artifactId, version: artifact.data.version, stored, article }, itemId, ctx)
}

/** Repair on a passing set is a no-op: the stored article and the recorded checks stay exactly as they are. */
function unchangedFix(target: FixTarget) {
  return {
    success: true as const,
    data: {
      itemId: target.card.id,
      artifactId: target.artifactId,
      article: target.article,
      checks: target.checks.map(check => ({ ...check })),
      changed: false,
    },
  }
}

/**
 * Repair only what a failing check flagged. The body is written back through
 * the artifact output (version bump) and the checks are re-run, so the item page
 * shows the scores of the repaired article. Never automatic — the owner asks.
 */
async function repairArticle(target: FixTarget, input: z.infer<typeof FixInputSchema>, ctx: CapabilityRunContext) {
  const chainContext = writeContext(ctx)
  const topic = input.topic ?? target.card.title
  const fixed = await contentChainService.fixArticle(chainContext, {
    article: target.article,
    brief: target.card.brief,
    topic,
    keyword: input.keyword ?? storedText(target.stored.keyword),
    instructions: input.instructions,
    checks: failingChecks(input.checks ?? []),
  })
  if (!fixed.success) return fixed
  const edited = await contentArtifactService.editArtifact(ctx.userId, target.artifactId, ctx.businessId, {
    version: target.version,
    output: { ...target.stored, article: fixed.data.article },
  }, ctx.event)
  if (!edited.success) return edited
  const rescored = await contentChainService.runChecks(chainContext, { itemId: target.card.id, draft: checkDraft(target, fixed.data.article), topic })
  if (!rescored.success) return rescored
  return {
    success: true as const,
    data: {
      itemId: target.card.id,
      artifactId: target.artifactId,
      article: fixed.data.article,
      checks: rescored.data,
      changed: fixed.data.article !== target.article,
    },
  }
}

async function runFix(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = FixInputSchema.parse(rawInput)
  const loaded = await loadFixTarget(input.itemId, ctx)
  if (!loaded.success) return loaded
  return failingChecks(input.checks ?? loaded.data.checks).length > 0
    ? repairArticle(loaded.data, input, ctx)
    : unchangedFix(loaded.data)
}

/**
 * Social publishing is a different action from article publishing and never
 * shares its confirmation step (PRD §10.1.5). The post goes through
 * `postService.create` — the same row `POST /api/v1/posts` creates — targeting
 * the owner's own connected account, and the artifact is read, never written.
 */
const SocialPublishInputSchema = z.object({
  itemId: z.string().min(1),
  /** `social_media_accounts.id` — a connected account, not a platform name. */
  accountId: z.string().min(1),
  platform: z.string().min(1).max(40),
  /** Omit to take the body this card already has for that platform. */
  text: z.string().max(5000).optional(),
  scheduleAt: z.string().min(1).max(60).optional(),
  hashtags: z.array(z.string().min(1).max(60)).max(30).default([]),
  mode: z.enum(['now', 'schedule']).default('now'),
})

const SocialPublishOutputSchema = z.object({
  accountId: z.string(),
  postId: z.string().optional(),
  scheduledJobId: z.string().optional(),
})

type SocialPublishInput = z.infer<typeof SocialPublishInputSchema>

function socialAccountRefusal(error: string, code: string) {
  return { success: false as const, error, code }
}

/** Ownership, business and liveness: a foreign or paused account never gets a post. */
async function verifySocialAccount(input: SocialPublishInput, ctx: CapabilityRunContext) {
  const account = await socialMediaAccountService.getAccountById(input.accountId, ctx.userId)
  if (!account || account.businessId !== ctx.businessId) {
    return socialAccountRefusal('That account is not available for this business', 'ACCOUNT_NOT_FOUND')
  }
  if (!account.isActive) return socialAccountRefusal('That account is not connected', 'ACCOUNT_INACTIVE')
  if (account.platform !== input.platform) {
    return socialAccountRefusal('That account is not on the chosen platform', 'ACCOUNT_PLATFORM_MISMATCH')
  }
  return { success: true as const, data: account }
}

function composeSocialText(text: string, hashtags: string[]): string {
  const tags = [...new Set(hashtags.map(tag => (tag.startsWith('#') ? tag : `#${tag}`)))]
  return [text.trim(), ...tags].filter(part => part.length > 0).join('\n\n')
}

/**
 * The social body for a platform, in the order the owner expects: the short
 * caption written for that platform, then the platform's variant body, then the
 * shared article.
 */
function socialBodyOf(stored: Record<string, unknown>, platform: string): string {
  const caption = storedVariants(stored)[platform.toLowerCase()] ?? ''
  if (caption) return caption
  const bodies = storedVariantBodies(stored)
  return bodies[platform] ?? bodies[platform.toLowerCase()] ?? storedArticle(stored)
}

async function storedOutputOf(itemId: string, ctx: CapabilityRunContext) {
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, itemId, ctx.event)
  if (!card.success) return card
  if (!card.data.artifactId) return socialAccountRefusal('This item has no content to publish yet', 'CONTENT_REQUIRED')
  const artifact = await contentArtifactService.getArtifact(ctx.userId, card.data.artifactId, ctx.businessId, ctx.event)
  if (!artifact.success) return artifact
  return { success: true as const, data: storedRecord(artifact.data.output) }
}

async function socialPostText(input: SocialPublishInput, ctx: CapabilityRunContext) {
  const explicit = storedText(input.text ?? '')
  if (explicit) return { success: true as const, data: composeSocialText(explicit, input.hashtags) }
  const stored = await storedOutputOf(input.itemId, ctx)
  if (!stored.success) return stored
  const body = socialBodyOf(stored.data, input.platform)
  if (!body) return socialAccountRefusal('This item has no text for that platform yet', 'CONTENT_REQUIRED')
  return { success: true as const, data: composeSocialText(body, input.hashtags) }
}

/** `now` is due immediately; `schedule` needs a parseable date the scheduler can honour. */
function socialScheduleAt(input: SocialPublishInput): Date | null {
  if (input.mode === 'now') return new Date()
  if (!input.scheduleAt) return null
  const when = new Date(input.scheduleAt)
  return Number.isNaN(when.getTime()) ? null : when
}

async function runSocialPublish(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = SocialPublishInputSchema.parse(rawInput)
  const account = await verifySocialAccount(input, ctx)
  if (!account.success) return account
  const text = await socialPostText(input, ctx)
  if (!text.success) return text
  const scheduledAt = socialScheduleAt(input)
  if (!scheduledAt) return socialAccountRefusal('Scheduling needs a date the scheduler can read', 'SCHEDULE_TIME_REQUIRED')
  const created = await postService.create(ctx.userId, {
    businessId: ctx.businessId,
    content: text.data,
    targetPlatforms: [account.data.id],
    mediaAssets: [],
    comment: [],
    scheduledAt,
    platformContent: { [input.platform]: text.data, comment: [] },
    platformSettings: {},
    postFormat: 'post',
    retryCount: 0,
  })
  if (!created.success) return created
  return { success: true as const, data: { accountId: account.data.id, postId: created.data.id } }
}

const CheckInputSchema = z.object({
  operation: z.enum(['seo-audit', 'extend', 'rewrite', 'internal-linking', 'social-post', 'carousel-draft']),
  content: z.string().max(30000).default(''),
  topic: z.string().max(500).optional(),
  platforms: PlatformsSchema,
})

function seoAudit(content: string) {
  const words = content.split(/\s+/).filter(Boolean).length
  const headings = (content.match(/^#{1,6}\s.+$/gm) ?? []).length
  const links = (content.match(/https?:\/\/[^\s)]+/g) ?? []).length
  const issues = [
    ...(words < 150 ? ['content_short'] : []),
    ...(headings < 2 ? ['few_headings'] : []),
    ...(links === 0 ? ['no_links'] : []),
  ]
  return { score: Math.max(0, 100 - issues.length * 20), wordCount: words, headingCount: headings, linkCount: links, issues }
}

const SeoAuditResultSchema = z.object({
  score: z.number(),
  wordCount: z.number(),
  headingCount: z.number(),
  linkCount: z.number(),
  issues: z.array(z.string()),
})

/** One drafted social post. Field names match `socialAi.ts`'s `toSocialPost`. */
const SocialPostSchema = z.object({
  platform: z.string(),
  text: z.string(),
  hashtags: z.array(z.string()),
})

/** `content.check`'s `social-post` operation is typed, not `unknown` (PRD §10 D08). */
const SocialPostsResultSchema = z.object({ posts: z.array(SocialPostSchema) })

type SocialPost = z.infer<typeof SocialPostSchema>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Hashtags the model declared, or the ones already in the text. */
function toHashtagList(value: unknown, text: string): string[] {
  if (Array.isArray(value)) return value.filter(tag => typeof tag === 'string')
  return text.match(/#[\p{L}\p{N}_]+/gu) ?? []
}

function withText(post: SocialPost): SocialPost[] {
  return post.text.length > 0 ? [post] : []
}

function toSocialPostEntry(entry: Record<string, unknown>, platform: string): SocialPost {
  const text = typeof entry.text === 'string' ? entry.text.trim() : ''
  const named = typeof entry.platform === 'string' ? entry.platform.trim() : ''
  return { platform: named || platform, text, hashtags: toHashtagList(entry.hashtags, text) }
}

/** Entries of a `{ "<platform>": entry }` map, or `[]` when the object is not one. */
function platformMapEntries(value: Record<string, unknown>): Array<Record<string, unknown>> {
  if (value.text !== undefined || value.platform !== undefined) return []
  const entries = Object.entries(value)
  if (!entries.every(([, entry]) => isRecord(entry))) return []
  return entries.map(([platform, entry]) => ({ ...(entry as Record<string, unknown>), platform }))
}

function socialPostList(entries: unknown[], platform: string): SocialPost[] {
  const posts = entries.filter(isRecord).map(entry => toSocialPostEntry(entry, platform))
  return posts.filter(post => post.text.length > 0)
}

/** An object that is either one entry or a `{platform: entry}` map of them. */
function socialPostsFromRecord(value: Record<string, unknown>, platform: string): SocialPost[] {
  const mapped = platformMapEntries(value)
  return mapped.length > 0 ? socialPostList(mapped, platform) : withText(toSocialPostEntry(value, platform))
}

/** Posts nested one level (`result.posts`, `posts`) or handed over as a `{platform: entry}` map. */
function toSocialPosts(value: unknown, platform: string): SocialPost[] {
  if (Array.isArray(value)) return socialPostList(value, platform)
  if (!isRecord(value)) return []
  if (value.posts !== undefined) return toSocialPosts(value.posts, platform)
  if (value.result !== undefined) return toSocialPosts(value.result, platform)
  return socialPostsFromRecord(value, platform)
}

/**
 * The typed `social-post` result: one entry per drafted post, platform-tagged,
 * empty-text entries dropped so the UI never renders a blank card.
 */
function socialPosts(raw: string, platforms: string[]): z.infer<typeof SocialPostsResultSchema> {
  return { posts: toSocialPosts(extractJsonObject(raw), platforms[0] ?? 'general') }
}

/**
 * Two operations carry a real shape; the rest stay opaque because their result
 * is whatever the model returned. The union parses in order, so a typed
 * operation is validated and stripped to its declared shape.
 */
const CheckOutputSchema = z.union([
  z.object({ operation: z.literal('seo-audit'), result: SeoAuditResultSchema }),
  z.object({ operation: z.literal('social-post'), result: SocialPostsResultSchema }),
  z.object({ operation: z.string(), result: z.unknown() }),
])

function checkPrompt(operation: z.infer<typeof CheckInputSchema>['operation'], input: z.infer<typeof CheckInputSchema>): string {
  const instructions: Record<string, string> = {
    extend: 'Extend the content with useful, non-repetitive sections while preserving its facts and voice.',
    rewrite: 'Rewrite the content for clarity, stronger structure, and a human voice without inventing facts.',
    'internal-linking': 'Suggest internal links and return improved markdown using [descriptive anchor](URL) placeholders where useful.',
    'social-post': 'Create platform-specific social post drafts from the content. Return {"result": {"posts": [{"platform": "<platform>", "text": "<the post>", "hashtags": ["#tag"]}]}}.',
    'carousel-draft': 'Create a concise carousel draft with slide headlines and body copy.',
  }
  return `${instructions[operation]}\nTopic: ${input.topic ?? 'not provided'}\nPlatforms: ${input.platforms.join(', ') || 'general'}\nContent:\n${input.content}\nReturn strict JSON with a result field.`
}

async function runCheck(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = CheckInputSchema.parse(rawInput)
  if (input.operation === 'seo-audit') return { success: true as const, data: { operation: input.operation, result: seoAudit(input.content) } }
  const raw = await ctx.complete({
    system: ctx.systemContext,
    prompt: checkPrompt(input.operation, input),
    maxTokens: 2400,
  })
  if (input.operation === 'social-post') {
    return { success: true as const, data: { operation: input.operation, result: socialPosts(raw, input.platforms) } }
  }
  const result = extractJsonObject(raw)?.result ?? raw.trim()
  return { success: true as const, data: { operation: input.operation, result } }
}

const contentScanCapability: Capability = {
  id: 'content.scan',
  title: 'Scan content ideas',
  description: 'Research a topic — or the business itself — and return grounded, pickable content ideas.',
  agent: runScan,
  inputSchema: ScanInputSchema,
  outputSchema: ScanOutputSchema,
  stream: 'none',
  render: 'ideas',
}

const contentWriteCapability: Capability = {
  id: 'content.write',
  title: 'Write content',
  description: 'Research an idea, write the article and the platform caption, and submit both for review.',
  agent: runWrite,
  inputSchema: WriteInputSchema,
  outputSchema: WriteOutputSchema,
  stream: 'none',
  render: 'draft',
}

const contentPublishCapability: Capability = {
  id: 'content.publish',
  title: 'Publish content',
  description: 'Release an approved content item through the publishing service.',
  agent: runPublish,
  inputSchema: PublishInputSchema,
  outputSchema: PublishOutputSchema,
  stream: 'none',
  render: 'delivery',
}

const contentMoveCapability: Capability = {
  id: 'content.move',
  title: 'Move a content card',
  description: 'Move a content card to another board column. The board decides whether the move is allowed.',
  agent: runMove,
  inputSchema: MoveInputSchema,
  outputSchema: MoveOutputSchema,
  stream: 'none',
  render: 'board',
}

const contentUpdateCapability: Capability = {
  id: 'content.update',
  title: 'Edit a content card',
  description: 'Edit the title, brief, platforms, target keyword or one platform body of a content card.',
  agent: runUpdate,
  inputSchema: UpdateInputSchema,
  outputSchema: UpdateOutputSchema,
  stream: 'none',
  render: 'board',
}

const contentDeleteCapability: Capability = {
  id: 'content.delete',
  title: 'Delete a content card',
  description: 'Delete a content card and its artifact. Refuses while the artifact is already delivered.',
  agent: runDelete,
  inputSchema: DeleteInputSchema,
  outputSchema: DeleteOutputSchema,
  stream: 'none',
  render: 'board',
}

const contentFixCapability: Capability = {
  id: 'content.fix',
  title: 'Fix the failing checks',
  description: 'Hand the failing checks and the article to the agent and repair it. Never runs on its own.',
  agent: runFix,
  inputSchema: FixInputSchema,
  outputSchema: FixOutputSchema,
  stream: 'none',
  render: 'draft',
}

const contentSocialPublishCapability: Capability = {
  id: 'content.social.publish',
  title: 'Post to a social account',
  description: 'Publish or schedule one platform post for a content card through its connected account.',
  agent: runSocialPublish,
  inputSchema: SocialPublishInputSchema,
  outputSchema: SocialPublishOutputSchema,
  stream: 'none',
  render: 'delivery',
}

const contentCheckCapability: Capability = {
  id: 'content.check',
  title: 'Check or transform content',
  description: 'Run SEO and content improvement operations from one extension point.',
  agent: runCheck,
  inputSchema: CheckInputSchema,
  outputSchema: CheckOutputSchema,
  stream: 'none',
  render: 'draft',
}

const CONTENT_CAPABILITIES: Capability[] = [
  contentScanCapability,
  contentWriteCapability,
  contentPublishCapability,
  contentMoveCapability,
  contentUpdateCapability,
  contentDeleteCapability,
  contentFixCapability,
  contentSocialPublishCapability,
  contentCheckCapability,
]

export function registerContentCapabilities(): void {
  for (const capability of CONTENT_CAPABILITIES) {
    if (!capabilityRegistry.has(capability.id)) capabilityRegistry.register(capability)
  }
}

registerContentCapabilities()

export {
  contentScanCapability,
  contentWriteCapability,
  contentPublishCapability,
  contentMoveCapability,
  contentUpdateCapability,
  contentDeleteCapability,
  contentFixCapability,
  contentSocialPublishCapability,
  contentCheckCapability,
}
