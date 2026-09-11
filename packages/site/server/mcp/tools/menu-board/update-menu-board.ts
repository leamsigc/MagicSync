import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'
import type { MenuBoardData } from '#layers/BaseDB/server/services/menu-board.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { orThrow } from '../../utils/mcp-results'
import { menuBoardPageInput, menuBoardSettingsInput, toServicePages, type MenuBoardPageInput } from '../../utils/carousel-shapes'

interface BoardUpdate {
  name?: string
  pages?: MenuBoardPageInput[]
  settings?: { transitionTime: number, unlockPin: string }
}

function mergeBoardUpdate(current: MenuBoardData, args: BoardUpdate): MenuBoardData {
  return {
    name: args.name ?? current.name,
    pages: args.pages ? toServicePages(args.pages) : current.pages,
    settings: args.settings
      ? { transitionTime: args.settings.transitionTime, isLocked: false, unlockPin: args.settings.unlockPin }
      : current.settings,
  }
}

export default defineMcpTool({
  description: 'Update a TV menu board in place (same row). Only provided fields change; tweak pages or settings between displays without republishing unless the public snapshot should refresh (then call publish-menu-board).',
  inputSchema: {
    boardId: z.string().describe('Board ID to update'),
    name: z.string().min(1).max(200).optional().describe('New board name'),
    pages: z.array(menuBoardPageInput).max(100).optional().describe('Full replacement page list'),
    settings: menuBoardSettingsInput.optional().describe('Replacement display settings'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const existing = orThrow(await menuBoardService.getForUser(userId, args.boardId), 'Menu board not found')
      const result = orThrow(await menuBoardService.upsert(userId, args.boardId, mergeBoardUpdate(existing, args)), 'Failed to update menu board')
      await logMcpCall(mcp, 'update-menu-board', args.boardId)
      return { boardId: args.boardId, name: result.name, pageCount: result.pages.length }
    }
    catch (error) {
      await logMcpCall(mcp, 'update-menu-board', args.boardId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
