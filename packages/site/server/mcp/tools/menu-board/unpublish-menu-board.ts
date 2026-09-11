import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Remove a TV menu board public display URL. The private board is kept.',
  inputSchema: {
    boardId: z.string().describe('Board ID to unpublish'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await menuBoardService.unpublish(userId, args.boardId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to unpublish menu board')
      }
      await logMcpCall(mcp, 'unpublish-menu-board', args.boardId)
      return { boardId: args.boardId, unpublished: true }
    }
    catch (error) {
      await logMcpCall(mcp, 'unpublish-menu-board', args.boardId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
