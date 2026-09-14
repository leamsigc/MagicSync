import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

function toolError(code: string | undefined, message: string): never {
  throw new Error(`${code ?? 'DELIVERY_ERROR'}: ${message}`)
}

async function requireCardArtifact(ctx: AgentToolContext, itemId: string) {
  const card = await contentBoardService.get(ctx.userId, ctx.businessId, itemId, ctx.event)
  if (!card.success) toolError(card.code, card.error)
  if (!card.data.artifactId) toolError('ARTIFACT_REQUIRED', 'Card has no artifact to deliver')
  return card.data
}

async function materializeAndReady(ctx: AgentToolContext, itemId: string) {
  const card = await requireCardArtifact(ctx, itemId)
  const moved = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'materializing', { actorKind: 'user' }, ctx.event)
  if (!moved.success) toolError(moved.code, moved.error)
  const materialized = await contentArtifactService.materializeArtifact(ctx.userId, card.artifactId as string, ctx.businessId, ctx.event)
  if (!materialized.success) toolError(materialized.code, materialized.error)
  const postId = materialized.data.postId
  await contentBoardService.linkPost(ctx.userId, ctx.businessId, itemId, postId, ctx.event)
  const ready = await contentBoardService.move(ctx.userId, ctx.businessId, itemId, 'ready', { actorKind: 'user' }, ctx.event)
  if (!ready.success) toolError(ready.code, ready.error)
  return { card: ready.data.item, postId, duplicate: materialized.data.duplicate }
}

export function createDeliveryTools(ctx: AgentToolContext): ToolDefinition[] {
  const itemParams = Type.Object({
    itemId: Type.String({ description: 'Content card id' }),
  })

  return [
    defineTool({
      name: 'create_post',
      label: 'Create post',
      description: 'Materialize an approved social-post artifact into a draft post.',
      parameters: itemParams,
      execute: async (_toolCallId, params) => toolResult(await materializeAndReady(ctx, params.itemId)),
    }),
    defineTool({
      name: 'create_carousel',
      label: 'Create carousel',
      description: 'Materialize an approved carousel artifact (2-10 Instagram slides).',
      parameters: itemParams,
      execute: async (_toolCallId, params) => toolResult(await materializeAndReady(ctx, params.itemId)),
    }),
    defineTool({
      name: 'create_reel_storyboard',
      label: 'Create reel storyboard',
      description: 'Materialize an approved reel storyboard artifact.',
      parameters: itemParams,
      execute: async (_toolCallId, params) => toolResult(await materializeAndReady(ctx, params.itemId)),
    }),
    defineTool({
      name: 'schedule_post',
      label: 'Schedule post',
      description: 'Schedule an approved, materialized artifact through the scheduler.',
      parameters: Type.Object({
        itemId: Type.String({ description: 'Content card id' }),
        scheduledAt: Type.Optional(Type.String({ description: 'ISO datetime (default now + 1 hour)' })),
      }),
      execute: async (_toolCallId, params) => {
        const card = await requireCardArtifact(ctx, params.itemId)
        const scheduledAt = params.scheduledAt ? new Date(params.scheduledAt) : new Date(Date.now() + 3600_000)
        const scheduled = await contentArtifactService.scheduleArtifact(ctx.userId, card.artifactId as string, ctx.businessId, scheduledAt, ctx.event)
        if (!scheduled.success) toolError(scheduled.code, scheduled.error)
        const moved = await contentBoardService.move(ctx.userId, ctx.businessId, params.itemId, 'scheduled', { actorKind: 'user' }, ctx.event)
        if (!moved.success) toolError(moved.code, moved.error)
        return toolResult({ card: moved.data.item, postId: scheduled.data.postId, scheduledAt: scheduledAt.toISOString() })
      },
    }),
    defineTool({
      name: 'publish',
      label: 'Publish content',
      description: 'Queue an approved artifact through the publishing service (GitHub/WordPress).',
      parameters: itemParams,
      execute: async (_toolCallId, params) => {
        const card = await requireCardArtifact(ctx, params.itemId)
        const connection = await publishingService.getActiveConnection(ctx.userId, ctx.businessId, ctx.event)
        if (!connection.success || !connection.data) {
          toolError('PUBLISH_CONNECTION_REQUIRED', 'No active publishing connection for this business')
        }
        const artifact = await contentArtifactService.getArtifact(ctx.userId, card.artifactId as string, ctx.businessId, ctx.event)
        if (!artifact.success) toolError(artifact.code, artifact.error)
        const job = await publishingService.createJob(ctx.userId, {
          businessId: ctx.businessId,
          connectionId: connection.data.id,
          artifactId: card.artifactId as string,
          artifactVersion: artifact.data.version,
        }, ctx.event)
        if (!job.success) toolError(job.code, job.error)
        const moved = await contentBoardService.move(ctx.userId, ctx.businessId, params.itemId, 'published', { actorKind: 'user' }, ctx.event)
        if (!moved.success) toolError(moved.code, moved.error)
        return toolResult({ card: moved.data.item, jobId: job.data.job.id, duplicate: job.data.duplicate })
      },
    }),
  ]
}
