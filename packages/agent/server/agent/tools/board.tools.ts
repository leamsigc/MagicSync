import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import type { ContentItem, ContentItemState } from '#layers/BaseDB/db/schema'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

function toolError(code: string | undefined, message: string): never {
  throw new Error(`${code ?? 'BOARD_ERROR'}: ${message}`)
}

function summarizeCard(card: ContentItem) {
  return {
    id: card.id,
    title: card.title,
    state: card.state,
    platforms: card.platforms,
    brief: card.brief,
    artifactId: card.artifactId,
    updatedAt: card.updatedAt,
  }
}

export function createBoardTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'board_list',
      label: 'List content cards',
      description: 'List content board cards for the current business. Optionally filter by state.',
      parameters: Type.Object({
        state: Type.Optional(Type.String({ description: 'Filter by card state (idea, drafting, review_required, ...)' })),
        limit: Type.Optional(Type.Number({ description: 'Maximum cards to return (default 50)' })),
      }),
      execute: async (_toolCallId, params) => {
        const result = await contentBoardService.list(ctx.userId, ctx.businessId, {
          state: params.state as ContentItemState | undefined,
          limit: params.limit ?? 50,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ cards: result.success ? result.data.map(summarizeCard) : [] })
      },
    }),
    defineTool({
      name: 'board_add_cards',
      label: 'Add content cards',
      description: 'Add content cards to the board in idea state for the current business.',
      parameters: Type.Object({
        cards: Type.Array(Type.Object({
          title: Type.String({ description: 'Card title' }),
          brief: Type.Optional(Type.String({ description: 'Short brief for the card' })),
          platforms: Type.Optional(Type.Array(Type.String(), { description: 'Target platforms' })),
          sourceRef: Type.Optional(Type.String({ description: 'Source reference (post URL, trend id)' })),
        })),
        sourceType: Type.Optional(Type.String({ description: 'trend | manual | template | repurpose' })),
      }),
      execute: async (_toolCallId, params) => {
        const result = await contentBoardService.addCards(ctx.userId, ctx.businessId, params.cards, {
          sourceType: (params.sourceType as 'trend' | 'manual' | 'template' | 'repurpose' | undefined) ?? 'manual',
          actorKind: 'agent',
          actorUserId: null,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ cards: result.success ? result.data.map(summarizeCard) : [] })
      },
    }),
    defineTool({
      name: 'board_move',
      label: 'Move a content card',
      description: 'Move a content card to another state. Agents cannot approve, schedule, publish, or archive.',
      parameters: Type.Object({
        itemId: Type.String({ description: 'Content card id' }),
        toState: Type.String({ description: 'Target state' }),
      }),
      execute: async (_toolCallId, params) => {
        const result = await contentBoardService.move(
          ctx.userId,
          ctx.businessId,
          params.itemId,
          params.toState as ContentItemState,
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
      label: 'Update a content card',
      description: 'Update a content card title, brief, platforms, or priority.',
      parameters: Type.Object({
        itemId: Type.String({ description: 'Content card id' }),
        title: Type.Optional(Type.String()),
        brief: Type.Optional(Type.String()),
        platforms: Type.Optional(Type.Array(Type.String())),
        priority: Type.Optional(Type.Number()),
      }),
      execute: async (_toolCallId, params) => {
        const result = await contentBoardService.update(ctx.userId, ctx.businessId, params.itemId, {
          title: params.title,
          brief: params.brief,
          platforms: params.platforms,
          priority: params.priority,
        }, { actorKind: 'agent' }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ card: result.success ? summarizeCard(result.data) : null })
      },
    }),
  ]
}
