import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { appUrl } from '../../utils/carousel-shapes'

export default defineMcpTool({
  description: 'Publish a TV menu board snapshot to a public shareable display URL (open it fullscreen on the restaurant TV). Only active pages show, sorted by order. Returns the share URL.',
  inputSchema: {
    boardId: z.string().describe('Board ID to publish'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await menuBoardService.publish(userId, args.boardId)
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to publish menu board')
      }
      await logMcpCall(mcp, 'publish-menu-board', args.boardId)
      return { boardId: args.boardId, slug: result.data.slug, shareUrl: `${appUrl()}/tools/menu-board/shared/${result.data.slug}` }
    }
    catch (error) {
      await logMcpCall(mcp, 'publish-menu-board', args.boardId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
