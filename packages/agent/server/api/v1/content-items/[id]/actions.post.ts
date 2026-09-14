import { z } from 'zod'
import type { H3Event } from 'h3'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { ContentItem } from '#layers/BaseDB/db/schema'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentChainService } from '#layers/BaseAgent/server/services/content-chain.service'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import { agentWorkflowService } from '#layers/BaseAgent/server/services/agent-workflow.service'
import { buildAgentRunConfig, runConfigErrorStatus, type RunConfig } from '#layers/BaseAgent/server/utils/run-config'

export const ContentActionSchema = z.object({
  businessId: z.string().min(1),
  action: z.enum(['research', 'generate', 'improve', 'submit-review', 'request-changes', 'approve', 'materialize', 'schedule', 'publish', 'archive']),
  scheduledAt: z.string().datetime().optional(),
  feedback: z.string().max(2000).optional(),
  platforms: z.array(z.string().min(1).max(40)).max(12).optional(),
})

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

async function handleGenerate(ctx: ActionContext) {
  const runConfig = await buildAgentRunConfig(ctx.userId, ctx.businessId, ctx.event)
  if (!runConfig.success) {
    throw createError({ statusCode: runConfigErrorStatus(runConfig.code), message: runConfig.error })
  }
  const result = await agentWorkflowService.runContentChain({
    userId: ctx.userId,
    businessId: ctx.businessId,
    itemId: ctx.itemId,
    complete: runConfig.data.complete,
    systemContext: runConfig.data.systemContext,
    run: runConfig.data,
    event: ctx.event,
  })
  if (!result.success) failure(result)
  if (!result.success) return null
  return { item: result.data.item, artifactId: result.data.artifactId, checks: result.data.checks }
}

async function handleImprove(ctx: ActionContext) {
  const runConfig = await buildAgentRunConfig(ctx.userId, ctx.businessId, ctx.event)
  if (!runConfig.success) {
    throw createError({ statusCode: runConfigErrorStatus(runConfig.code), message: runConfig.error })
  }
  const result = await contentChainService.reviseDraft({
    userId: ctx.userId,
    businessId: ctx.businessId,
    complete: runConfig.data.complete,
    brandContext: runConfig.data.systemContext,
    event: ctx.event,
  }, { itemId: ctx.itemId, feedback: ctx.body.feedback, onlyPlatforms: ctx.body.platforms })
  if (!result.success) failure(result)
  if (!result.success) return null
  await contentBoardService.recordRun(ctx.userId, ctx.businessId, ctx.itemId, {
    step: 'improve',
    status: 'completed',
  }, ctx.event)
  return { item: result.data.item, artifactId: result.data.artifactId, caption: result.data.caption, checks: result.data.checks }
}

async function requireCard(ctx: ActionContext) {
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, ctx.itemId, ctx.event)
  if (!card.success) failure(card)
  if (!card.success) return null
  return card.data
}

async function researchCardBrief(
  ctx: ActionContext,
  run: RunConfig,
  card: ContentItem,
): Promise<ServiceResponse<{ brief: string }>> {
  const gathered = await agentWorkflowService.runResearchTask({
    userId: ctx.userId,
    businessId: ctx.businessId,
    topic: `${card.title}. ${card.brief ?? ''}`.trim(),
    run,
    event: ctx.event,
  })
  if (!gathered.success) return gathered
  const saved = await contentBoardService.update(ctx.userId, ctx.businessId, card.id, {
    brief: gathered.data.brief,
  }, { actorKind: 'user', actorUserId: ctx.userId }, ctx.event)
  if (!saved.success) return saved
  return { success: true, data: { brief: gathered.data.brief } }
}

async function advanceResearchState(ctx: ActionContext) {
  const researching = await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, 'researching', {
    actorKind: 'user',
    actorUserId: ctx.userId,
  }, ctx.event)
  if (!researching.success) return researching
  return contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, 'research_ready', {
    actorKind: 'user',
    actorUserId: ctx.userId,
  }, ctx.event)
}

async function handleResearch(ctx: ActionContext) {
  const log = useLogger(ctx.event)
  log.set({ userId: ctx.userId, businessId: ctx.businessId, itemId: ctx.itemId })
  log.info({ message: 'research.action.started' })
  const card = await requireCard(ctx)
  if (!card) return null
  const runConfig = await buildAgentRunConfig(ctx.userId, ctx.businessId, ctx.event)
  if (!runConfig.success) {
    throw createError({ statusCode: runConfigErrorStatus(runConfig.code), message: runConfig.error })
  }
  const researched = await researchCardBrief(ctx, runConfig.data, card)
  if (!researched.success) {
    await contentBoardService.recordRun(ctx.userId, ctx.businessId, ctx.itemId, {
      step: 'research',
      status: 'failed',
      error: researched.error,
    }, ctx.event)
    log.error({ message: 'research.action.failed', error: researched.error })
    failure(researched)
  }
  if (!researched.success) return null
  await contentBoardService.recordRun(ctx.userId, ctx.businessId, ctx.itemId, {
    step: 'research',
    status: 'completed',
  }, ctx.event)
  const moved = await advanceResearchState(ctx)
  if (!moved.success) failure(moved)
  if (!moved.success) return null
  log.info({ message: 'research.action.completed', state: moved.data.item.state })
  return { item: moved.data.item, brief: researched.data.brief }
}

async function handleMaterialize(ctx: ActionContext) {
  const card = await requireCard(ctx)
  if (!card) return null
  if (!card.artifactId) failure({ error: 'Card has no artifact to materialize', code: 'ARTIFACT_REQUIRED' })

  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, 'materializing', { actorKind: 'user' }, ctx.event)
  if (!moved.success) failure(moved)
  const materialized = await contentArtifactService.materializeArtifact(ctx.userId, card.artifactId as string, ctx.businessId, ctx.event)
  if (!materialized.success) {
    await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, 'failed', { actorKind: 'user' }, ctx.event)
    failure(materialized)
  }
  if (!materialized.success) return null
  await contentBoardService.linkPost(ctx.userId, ctx.businessId, ctx.itemId, materialized.data.postId, ctx.event)
  const ready = await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, 'ready', { actorKind: 'user' }, ctx.event)
  if (!ready.success) failure(ready)
  if (!ready.success) return null
  return { item: ready.data.item, postId: materialized.data.postId, duplicate: materialized.data.duplicate }
}

async function handleSchedule(ctx: ActionContext) {
  const card = await requireCard(ctx)
  if (!card) return null
  if (!card.artifactId) failure({ error: 'Card has no approved artifact', code: 'ARTIFACT_REQUIRED' })
  const scheduledAt = ctx.body.scheduledAt ? new Date(ctx.body.scheduledAt) : new Date(Date.now() + 3600_000)
  const scheduled = await contentArtifactService.scheduleArtifact(ctx.userId, card.artifactId as string, ctx.businessId, scheduledAt, ctx.event)
  if (!scheduled.success) failure(scheduled)
  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, 'scheduled', {
    actorKind: 'user',
    actorUserId: ctx.userId,
    payload: { scheduledAt: scheduledAt.toISOString() },
  }, ctx.event)
  if (!moved.success) failure(moved)
  if (!moved.success) return null
  return { item: moved.data.item, postId: scheduled.success ? scheduled.data.postId : null }
}

async function handlePublish(ctx: ActionContext) {
  const card = await requireCard(ctx)
  if (!card) return null
  if (!card.artifactId) failure({ error: 'Card has no approved artifact', code: 'ARTIFACT_REQUIRED' })

  const connection = await publishingService.getActiveConnection(ctx.userId, ctx.businessId, ctx.event)
  if (!connection.success || !connection.data) {
    failure({ error: 'No active publishing connection for this business', code: 'PUBLISH_CONNECTION_REQUIRED' })
  }
  if (!connection.success || !connection.data) return null

  const artifact = await contentArtifactService.getArtifact(ctx.userId, card.artifactId, ctx.businessId, ctx.event)
  if (!artifact.success) failure(artifact)
  if (!artifact.success) return null

  const job = await publishingService.createJob(ctx.userId, {
    businessId: ctx.businessId,
    connectionId: connection.data.id,
    artifactId: card.artifactId,
    artifactVersion: artifact.data.version,
  }, ctx.event)
  if (!job.success) failure(job)
  if (!job.success) return null

  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, 'published', {
    actorKind: 'user',
    actorUserId: ctx.userId,
    payload: { jobId: job.data.job.id },
  }, ctx.event)
  if (!moved.success) failure(moved)
  if (!moved.success) return null
  return { item: moved.data.item, jobId: job.data.job.id, duplicate: job.data.duplicate }
}

async function handleMove(ctx: ActionContext, toState: 'researching' | 'review_required' | 'changes_requested' | 'approved' | 'archived') {
  const result = await contentBoardService.move(ctx.userId, ctx.businessId, ctx.itemId, toState, {
    actorKind: 'user',
    actorUserId: ctx.userId,
    payload: { action: ctx.body.action },
  }, ctx.event)
  if (!result.success) failure(result)
  if (!result.success) return null
  return { item: result.data.item, from: result.data.from, to: result.data.to }
}

const HANDLERS: Record<ContentAction, (ctx: ActionContext) => Promise<unknown>> = {
  research: handleResearch,
  'submit-review': ctx => handleMove(ctx, 'review_required'),
  'request-changes': ctx => handleMove(ctx, 'changes_requested'),
  approve: ctx => handleMove(ctx, 'approved'),
  archive: ctx => handleMove(ctx, 'archived'),
  generate: handleGenerate,
  improve: handleImprove,
  materialize: handleMaterialize,
  schedule: handleSchedule,
  publish: handlePublish,
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
