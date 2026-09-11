import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'List saved TV menu boards, newest first. Summaries only — use get-menu-board for full pages.',
  inputSchema: {},
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler() {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const result = await menuBoardService.listForUser(userId)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to list menu boards')
    }
    return {
      boards: result.data.map(b => ({
        id: b?.id,
        name: b?.name,
        pageCount: b?.pages.length ?? 0,
        isPublic: b?.isPublic ?? false,
        shareSlug: b?.shareSlug,
        updatedAt: b?.updatedAt,
      })),
    }
  },
})
