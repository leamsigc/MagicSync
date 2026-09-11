import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { menuBoardPageInput, menuBoardSettingsInput, toServicePages } from '../../utils/carousel-shapes'

export default defineMcpTool({
  description: 'Create a TV menu board (digital signage): named pages of inline-styled HTML or images plus display settings. Boards are save/share only — they never become social posts.',
  inputSchema: {
    name: z.string().min(1).max(200).describe('Board name, e.g. "Downtown lunch menu"'),
    pages: z.array(menuBoardPageInput).max(100).describe('Menu pages in any order (sorted by order on display)'),
    settings: menuBoardSettingsInput.describe('Display settings'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)
    const boardId = crypto.randomUUID()

    try {
      const result = await menuBoardService.upsert(userId, boardId, {
        name: args.name,
        pages: toServicePages(args.pages),
        settings: { transitionTime: args.settings.transitionTime, isLocked: false, unlockPin: args.settings.unlockPin },
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create menu board')
      }
      await logMcpCall(mcp, 'create-menu-board', boardId)
      return { boardId, name: result.data.name, pageCount: result.data.pages.length }
    }
    catch (error) {
      await logMcpCall(mcp, 'create-menu-board', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
