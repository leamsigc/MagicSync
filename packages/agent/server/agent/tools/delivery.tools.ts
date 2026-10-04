import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { directScheduleService } from '#layers/BaseDB/server/services/direct-schedule.service'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'DELIVERY_ERROR')

type DeliveryProvider = 'github' | 'wordpress'

/** WordPress is the delivery default everywhere else (`content.publish` too). */
const DEFAULT_DELIVERY_PROVIDER: DeliveryProvider = 'wordpress'

async function requireCardArtifact(ctx: AgentToolContext, itemId: string) {
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, itemId, ctx.event)
  if (!card.success) toolError(card.code, card.error)
  if (!card.data.artifactId) toolError('ARTIFACT_REQUIRED', 'Card has no artifact to deliver')
  return card.data
}

/**
 * `getActiveConnection(userId, businessId, provider, event)` takes a provider in
 * its third slot — the event used to be passed there, so the lookup could never
 * match a row and every `publish` call failed with PUBLISH_CONNECTION_REQUIRED.
 */
async function requireActiveConnection(ctx: AgentToolContext, provider: DeliveryProvider) {
  const connection = await publishingService.getActiveConnection(ctx.userId, ctx.businessId, provider, ctx.event)
  if (!connection.success || !connection.data) {
    toolError('PUBLISH_CONNECTION_REQUIRED', `No active ${provider} publishing connection for this business`)
  }
  return connection.data
}

/** Queue an approved artifact through the publishing service (GitHub/WordPress). */
async function publishThrough(ctx: AgentToolContext, itemId: string, provider: DeliveryProvider) {
  const card = await requireCardArtifact(ctx, itemId)
  const connection = await requireActiveConnection(ctx, provider)
  const artifact = await contentArtifactService.getArtifact(ctx.userId, card.artifactId as string, ctx.businessId, ctx.event)
  if (!artifact.success) toolError(artifact.code, artifact.error)
  const job = await publishingService.createJob(ctx.userId, {
    businessId: ctx.businessId,
    connectionId: connection.id,
    artifactId: card.artifactId as string,
    artifactVersion: artifact.data.version,
  }, ctx.event)
  if (!job.success) toolError(job.code, job.error)
  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'published', { actorKind: 'user' }, ctx.event)
  if (!moved.success) toolError(moved.code, moved.error)
  return toolResult({ card: moved.data.item, jobId: job.data.job.id, duplicate: job.data.duplicate })
}

/** Materialize an approved artifact and move the card to scheduled (atomic approve). */
async function materializeAndSchedule(ctx: AgentToolContext, itemId: string) {
  const card = await requireCardArtifact(ctx, itemId)
  const materialized = await contentArtifactService.materializeArtifact(ctx.userId, card.artifactId as string, ctx.businessId, ctx.event)
  if (!materialized.success) toolError(materialized.code, materialized.error)
  const postId = materialized.data.postId
  await contentBoardService.linkPost(ctx.userId, ctx.businessId, itemId, postId, ctx.event)
  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'scheduled', { actorKind: 'user' }, ctx.event)
  if (!moved.success) toolError(moved.code, moved.error)
  return { card: moved.data.item, postId, duplicate: materialized.data.duplicate }
}

/**
 * The five delivery tools for one run. `actorKind: 'user'` is kept exactly as
 * before on the state transitions the materialize/schedule/publish flows
 * perform — delivery remains the approved-artifact path, unchanged by T28.
 */
export function createDeliveryTools(ctx: AgentToolContext): ToolDefinition[] {
  const itemInput = v.object({
    itemId: v.pipe(v.string(), v.description('Content card id')),
  })

  return [
    defineTool({
      name: 'create_post',
      description: 'Materialize an approved social-post artifact into a draft post.',
      input: itemInput,
      run: async toolCtx => toolResult(await materializeAndSchedule(ctx, toolCtx.data.itemId)),
    }),
    defineTool({
      name: 'create_carousel',
      description: 'Materialize an approved carousel artifact (2-10 Instagram slides).',
      input: itemInput,
      run: async toolCtx => toolResult(await materializeAndSchedule(ctx, toolCtx.data.itemId)),
    }),
    defineTool({
      name: 'create_reel_storyboard',
      description: 'Materialize an approved reel storyboard artifact.',
      input: itemInput,
      run: async toolCtx => toolResult(await materializeAndSchedule(ctx, toolCtx.data.itemId)),
    }),
    defineTool({
      name: 'schedule_post',
      description: 'Schedule an approved, materialized artifact through the scheduler.',
      input: v.object({
        itemId: v.pipe(v.string(), v.description('Content card id')),
        scheduledAt: v.optional(v.pipe(v.string(), v.description('ISO datetime (default now + 1 hour)'))),
      }),
      run: async (toolCtx) => {
        const { itemId, scheduledAt: iso } = toolCtx.data
        const card = await requireCardArtifact(ctx, itemId)
        const scheduledAt = iso ? new Date(iso) : new Date(Date.now() + 3600_000)
        const scheduled = await contentArtifactService.scheduleArtifact(ctx.userId, card.artifactId as string, ctx.businessId, scheduledAt, ctx.event)
        if (!scheduled.success) toolError(scheduled.code, scheduled.error)
        const moved = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'scheduled', { actorKind: 'user' }, ctx.event)
        if (!moved.success) toolError(moved.code, moved.error)
        return toolResult({ card: moved.data.item, postId: scheduled.data.postId, scheduledAt: scheduledAt.toISOString() })
      },
    }),
    defineTool({
      name: 'publish',
      description: 'Queue an approved artifact through the publishing service (GitHub/WordPress).',
      input: v.object({
        itemId: v.pipe(v.string(), v.description('Content card id')),
        provider: v.optional(v.pipe(v.picklist(['github', 'wordpress']), v.description('Delivery provider (default wordpress)'))),
      }),
      run: async (toolCtx) => publishThrough(ctx, toolCtx.data.itemId, toolCtx.data.provider ?? DEFAULT_DELIVERY_PROVIDER),
    }),
    defineTool({
      name: 'schedule_direct_posts',
      description: 'Schedule a chat brief directly to connected social accounts.',
      input: v.object({
        brief: v.pipe(v.string(), v.description('Post brief')),
        platforms: v.pipe(v.array(v.string()), v.description('Platform names')),
        timeframe: v.pipe(v.string(), v.description('Timeframe phrase')),
        scheduledAt: v.optional(v.pipe(v.string(), v.description('ISO datetime'))),
        accountIds: v.optional(v.pipe(v.array(v.string()), v.description('Account ids'))),
      }),
      run: async (toolCtx) => {
        const result = await directScheduleService.scheduleDirect(ctx.userId, ctx.businessId, toolCtx.data, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.data)
      },
    }),
  ]
}
