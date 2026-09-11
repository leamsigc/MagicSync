import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'
import { appUrl } from '../../utils/carousel-shapes'

export default defineMcpTool({
  description: 'Get a full TV menu board: every page with content, settings, and the public share URL when published.',
  inputSchema: {
    boardId: z.string().describe('Board ID from create-menu-board or list-menu-boards'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const result = await menuBoardService.getForUser(userId, args.boardId)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Menu board not found')
    }
    const board = result.data
    return {
      id: board.id,
      name: board.name,
      pages: board.pages,
      settings: board.settings,
      isPublic: board.isPublic ?? false,
      shareUrl: board.shareSlug ? `${appUrl()}/tools/menu-board/shared/${board.shareSlug}` : null,
      updatedAt: board.updatedAt,
    }
  },
})
