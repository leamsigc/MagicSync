import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Permanently delete a post and its scheduled publish jobs. Cannot be undone; already-published platform posts stay live on the networks.',
  inputSchema: {
    postId: z.string().describe('ID of the post to delete'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await postService.delete(args.postId, userId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete post (it may be published or owned by another user)')
      }
      await logMcpCall(mcp, 'delete-post', args.postId)
      return { postId: args.postId, deleted: true }
    }
    catch (error) {
      await logMcpCall(mcp, 'delete-post', args.postId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
