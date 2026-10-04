import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { contentBoardService, type ContentCardInput } from '#layers/BaseDB/server/services/content-board.service'
import { ContentItemFormatSchema, type ContentItem, type ContentItemState } from '#layers/BaseDB/db/schema'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'BOARD_ERROR')

interface BoardCardParam {
  title: string
  brief?: string
  format?: string
  platforms?: string[]
  sourceRef?: string
}

/** The tool takes free-form strings; only a known format reaches the board. */
function toCardInput(card: BoardCardParam): ContentCardInput {
  const format = ContentItemFormatSchema.safeParse(card.format)
  return {
    title: card.title,
    brief: card.brief,
    platforms: card.platforms,
    sourceRef: card.sourceRef,
    ...(format.success ? { format: format.data } : {}),
  }
}

export function summarizeCard(card: ContentItem) {
  return {
    id: card.id,
    title: card.title,
    state: card.state,
    format: card.format,
    platforms: card.platforms,
    brief: card.brief,
    artifactId: card.artifactId,
    // Drizzle timestamp columns arrive as Date: Flue rejects non-JSON
    // tool output, so serialize at the boundary.
    updatedAt: card.updatedAt instanceof Date ? card.updatedAt.toISOString() : card.updatedAt,
  }
}

/**
 * The four board tools for one run. Tenant identity is closed over by `ctx` at
 * mount time: the valibot `input` schemas carry no `userId`/`businessId`, and
 * valibot strips unknown keys, so a model-supplied business can never reach a
 * service call.
 */
export function createBoardTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'board_list',
      description: 'List content board cards for the current business. Optionally filter by state.',
      input: v.object({
        state: v.optional(v.pipe(v.string(), v.description('Filter by card state (idea, drafting, review_required, ...)'))),
        limit: v.optional(v.pipe(v.number(), v.description('Maximum cards to return (default 50)'))),
      }),
      run: async (toolCtx) => {
        const { state, limit } = toolCtx.data
        const result = await contentBoardService.list(ctx.userId, ctx.businessId, {
          state: state as ContentItemState | undefined,
          limit: limit ?? 50,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ cards: result.success ? result.data.map(summarizeCard) : [] })
      },
    }),
    defineTool({
      name: 'board_add_cards',
      description: 'Add content cards to the board in idea state for the current business.',
      input: v.object({
        cards: v.array(v.object({
          title: v.pipe(v.string(), v.description('Card title')),
          brief: v.optional(v.pipe(v.string(), v.description('Short brief for the card'))),
          format: v.optional(v.pipe(v.string(), v.description('Deliverable the card generates: social_post (default), carousel, reel, or article. Use carousel for multi-slide ideas.'))),
          platforms: v.optional(v.array(v.string())),
          sourceRef: v.optional(v.pipe(v.string(), v.description('Source reference (post URL, trend id)'))),
        })),
        sourceType: v.optional(v.pipe(v.string(), v.description('trend | manual | template | repurpose'))),
      }),
      run: async (toolCtx) => {
        const { cards, sourceType } = toolCtx.data
        const result = await contentBoardService.addCards(ctx.userId, ctx.businessId, cards.map(toCardInput), {
          sourceType: (sourceType as 'trend' | 'manual' | 'template' | 'repurpose' | undefined) ?? 'manual',
          actorKind: 'agent',
          actorUserId: null,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ cards: result.success ? result.data.map(summarizeCard) : [] })
      },
    }),
    defineTool({
      name: 'board_move',
      description: 'Move a content card to another state. Agents cannot approve, schedule, publish, or archive.',
      input: v.object({
        itemId: v.pipe(v.string(), v.description('Content card id')),
        toState: v.pipe(v.string(), v.description('Target state')),
      }),
      run: async (toolCtx) => {
        const { itemId, toState } = toolCtx.data
        const result = await contentBoardService.move(
          ctx.userId,
          ctx.businessId,
          itemId,
          toState as ContentItemState,
          { actorKind: 'agent' },
          ctx.event,
        )
        if (!result.success) toolError(result.code, result.error)
        return toolResult({
          card: result.success ? summarizeCard(result.data.item) : null,
          from: result.success ? result.data.from : null,
          to: result.success ? result.data.to : null,
        })
      },
    }),
    defineTool({
      name: 'board_update',
      description: 'Update a content card title, brief, platforms, or priority.',
      input: v.object({
        itemId: v.pipe(v.string(), v.description('Content card id')),
        title: v.optional(v.string()),
        brief: v.optional(v.string()),
        platforms: v.optional(v.array(v.string())),
        priority: v.optional(v.number()),
      }),
      run: async (toolCtx) => {
        const { itemId, title, brief, platforms, priority } = toolCtx.data
        const result = await contentBoardService.update(ctx.userId, ctx.businessId, itemId, {
          title,
          brief,
          platforms,
          priority,
        }, { actorKind: 'agent' }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ card: result.success ? summarizeCard(result.data) : null })
      },
    }),
  ]
}
