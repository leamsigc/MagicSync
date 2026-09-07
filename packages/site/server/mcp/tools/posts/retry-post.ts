import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Reset a failed post (and its failed platform jobs) back to pending so the scheduler retries it. Only works on posts with failed attempts.',
  inputSchema: {
    postId: z.string().describe('ID of the failed post to retry'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await postService.retryFailedPost(args.postId, userId)
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Post has no failed attempts to retry')
      }
      await logMcpCall(mcp, 'retry-post', args.postId)
      return { postId: args.postId, status: (result.data as { status: string }).status, retried: true }
    }
    catch (error) {
      await logMcpCall(mcp, 'retry-post', args.postId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
