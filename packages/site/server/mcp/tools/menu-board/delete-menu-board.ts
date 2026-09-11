import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Permanently delete a TV menu board and its public share link. Cannot be undone.',
  inputSchema: {
    boardId: z.string().describe('Board ID to delete'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await menuBoardService.remove(userId, args.boardId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete menu board (it may not exist or belong to another user)')
      }
      await logMcpCall(mcp, 'delete-menu-board', args.boardId)
      return { boardId: args.boardId, deleted: true }
    }
    catch (error) {
      await logMcpCall(mcp, 'delete-menu-board', args.boardId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
