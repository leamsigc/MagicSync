import { z } from 'zod'
import type { H3Event } from 'h3'
import type { ContentItem, ContentItemFormat } from '#layers/BaseDB/db/schema'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentChainService } from '#layers/BaseAgent/server/services/content-chain.service'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { agentWorkflowService } from '#layers/BaseAgent/server/services/agent-workflow.service'
import { buildAgentRunConfig, runConfigErrorStatus } from '#layers/BaseAgent/server/utils/run-config'

export const ContentActionSchema = z.object({
  businessId: z.string().min(1),
  action: z.enum([
    'generate', // idea → drafting (content chain)
    'submit-review', // drafting → review_required
    'request-changes', // review_required → drafting (with feedback)
    'approve', // review_required → scheduled (validates + materializes artifact)
    'publish', // scheduled → published (Safe Mode gate)
    'reset', // failed → idea
    'archive', // any → archived
  ]),
  scheduledAt: z.string().datetime().optional(),
  feedback: z.string().max(2000).optional(), // for request-changes
  platforms: z.array(z.string().min(1).max(40)).max(12).optional(),
  /** Delivery target for `publish`; omitted means the platform default. */
  provider: z.enum(['github', 'wordpress']).optional(),
  safeMode: z.boolean().optional(), // override business default
})

/** WordPress is the delivery default everywhere else (`content.publish` too). */
const DEFAULT_PUBLISH_PROVIDER = 'wordpress'

type ContentAction = z.infer<typeof ContentActionSchema>['action']

interface ActionContext {
  event: H3Event
  userId: string
  businessId: string
  itemId: string
  body: z.infer<typeof ContentActionSchema>
}

function failure(result: { error?: string, code?: string }): never {
  throw createError({
    statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
    statusMessage: result.error,
    data: { code: result.code },
  })
}

async function requireCard(ctx: ActionContext) {
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, ctx.itemId, ctx.event)
  if (!card.success) failure(card)
  return card.data
}

async function moveCard(
  ctx: ActionContext,
  toState: ContentItem['state'],
  payload?: Record<string, unknown>,
) {
  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, toState, {
    actorKind: 'user',
    actorUserId: ctx.userId,
    payload: payload ?? { action: ctx.body.action },
  }, ctx.event)
  if (!moved.success) failure(moved)
  return moved.data
}

async function loadRunConfig(ctx: ActionContext) {
  const runConfig = await buildAgentRunConfig(ctx.userId, ctx.businessId, ctx.event)
  if (!runConfig.success) {
    throw createError({ statusCode: runConfigErrorStatus(runConfig.code), message: runConfig.error })
  }
  return runConfig.data
}

/** idea → drafting via the full content chain (research → write → humanize → checks → review). */
async function handleGeneratePost(ctx: ActionContext) {
  const run = await loadRunConfig(ctx)
  const result = await agentWorkflowService.runContentChain({
    userId: ctx.userId,
    businessId: ctx.businessId,
    itemId: ctx.itemId,
    complete: run.complete,
    systemContext: run.systemContext,
    run,
    event: ctx.event,
  })
  if (!result.success) failure(result)
  return { item: result.data.item, artifactId: result.data.artifactId, checks: result.data.checks }
}

/** Carousel cards run the carousel workflow instead: research → slides → review. */
async function handleGenerateCarousel(ctx: ActionContext) {
  const run = await loadRunConfig(ctx)
  const result = await agentWorkflowService.runCarouselChain({
    userId: ctx.userId,
    businessId: ctx.businessId,
    itemId: ctx.itemId,
    complete: run.complete,
    systemContext: run.systemContext,
    event: ctx.event,
  })
  if (!result.success) failure(result)
  return { item: result.data.item, artifactId: result.data.artifactId, slideCount: result.data.slideCount }
}

/** The card's format picks the workflow the Generate action runs. */
const GENERATE_BY_FORMAT: Record<ContentItemFormat, (ctx: ActionContext) => Promise<unknown>> = {
  social_post: handleGeneratePost,
  article: handleGeneratePost,
  reel: handleGeneratePost,
  carousel: handleGenerateCarousel,
}

async function handleGenerate(ctx: ActionContext) {
  const card = await requireCard(ctx)
  return GENERATE_BY_FORMAT[card.format](ctx)
}

/** drafting → review_required; no agent run. */
async function handleSubmitReview(ctx: ActionContext) {
  const data = await moveCard(ctx, 'review_required')
  return { item: data.item, from: data.from, to: data.to }
}

/** review_required → drafting, carrying reviewer feedback. */
async function handleRequestChanges(ctx: ActionContext) {
  const data = await moveCard(ctx, 'drafting', {
    action: 'request-changes',
    feedback: ctx.body.feedback ?? null,
  })
  return { item: data.item, from: data.from, to: data.to, feedback: ctx.body.feedback ?? null }
}

/** review_required → scheduled; validates the artifact and materializes it atomically. */
async function handleApprove(ctx: ActionContext) {
  const card = await requireCard(ctx)
  if (!card.artifactId) failure({ error: 'Card has no approved artifact', code: 'ARTIFACT_REQUIRED' })
  const materialized = await contentArtifactService.materializeArtifact(ctx.userId, card.artifactId, ctx.businessId, ctx.event)
  if (!materialized.success) failure(materialized)
  await contentBoardService.linkPost(ctx.userId, ctx.businessId, ctx.itemId, materialized.data.postId, ctx.event)
  const data = await moveCard(ctx, 'scheduled', { action: 'approve', postId: materialized.data.postId })
  return { item: data.item, postId: materialized.data.postId, duplicate: materialized.data.duplicate }
}

/**
 * `getActiveConnection(userId, businessId, provider, event)` takes a provider
 * in its third slot — the event used to be passed there, so the lookup could
 * never match a row. The request's `provider` wins; otherwise the platform
 * default.
 */
async function requirePublishConnection(ctx: ActionContext) {
  const provider = ctx.body.provider ?? DEFAULT_PUBLISH_PROVIDER
  const connection = await publishingService.getActiveConnection(ctx.userId, ctx.businessId, provider, ctx.event)
  if (!connection.success || !connection.data) {
    failure({ error: `No active ${provider} publishing connection for this business`, code: 'PUBLISH_CONNECTION_REQUIRED' })
  }
  return connection.data
}

/** scheduled → published; blocked while Safe Mode is on (unless overridden per request). */
async function handlePublish(ctx: ActionContext) {
  const card = await requireCard(ctx)
  if (!card.artifactId) failure({ error: 'Card has no approved artifact', code: 'ARTIFACT_REQUIRED' })

  const safeMode = ctx.body.safeMode ?? await resolveSafeMode(ctx)
  if (safeMode) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Confirm before publishing: Safe Mode requires a manual release',
      data: { code: 'SAFE_MODE_REQUIRED' },
    })
  }

  const connection = await requirePublishConnection(ctx)

  const artifact = await contentArtifactService.getArtifact(ctx.userId, card.artifactId, ctx.businessId, ctx.event)
  if (!artifact.success) failure(artifact)

  const job = await publishingService.createJob(ctx.userId, {
    businessId: ctx.businessId,
    connectionId: connection.id,
    artifactId: card.artifactId,
    artifactVersion: artifact.data.version,
  }, ctx.event)
  if (!job.success) failure(job)

  const data = await moveCard(ctx, 'published', { action: 'publish', jobId: job.data.job.id })
  return { item: data.item, jobId: job.data.job.id, duplicate: job.data.duplicate }
}

/** failed → idea: clears last_error and resets retry_count. */
async function handleReset(ctx: ActionContext) {
  const result = await contentBoardService.resetFailed(ctx.userId, ctx.businessId, ctx.itemId, {
    actorKind: 'user',
    actorUserId: ctx.userId,
    payload: { action: 'reset' },
  }, ctx.event)
  if (!result.success) failure(result)
  return { item: result.data.item, from: result.data.from, to: result.data.to }
}

/** Any → archived. */
async function handleArchive(ctx: ActionContext) {
  const data = await moveCard(ctx, 'archived')
  return { item: data.item, from: data.from, to: data.to }
}

async function resolveSafeMode(ctx: ActionContext) {
  const setting = await businessProfileService.getSafeMode(ctx.businessId, ctx.event)
  return setting.success ? setting.data : true
}

const HANDLERS: Record<ContentAction, (ctx: ActionContext) => Promise<unknown>> = {
  generate: handleGenerate,
  'submit-review': handleSubmitReview,
  'request-changes': handleRequestChanges,
  approve: handleApprove,
  publish: handlePublish,
  reset: handleReset,
  archive: handleArchive,
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Item id is required' })
  const body = ContentActionSchema.parse(await readBody(event))

  return HANDLERS[body.action]({
    event,
    userId: user.id,
    businessId: body.businessId,
    itemId: id,
    body,
  })
})
