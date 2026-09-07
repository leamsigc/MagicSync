import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'Get per-platform publish state for a post: which accounts it targets, their status (pending/published/failed), platform post IDs, and error messages.',
  inputSchema: {
    postId: z.string().describe('ID of the post'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    // findByIdFull (not getPlatformPostsByPost, which is unscoped) so the
    // key-binding check below actually means something.
    let post
    try {
      post = await postService.findByIdFull({ postId: args.postId, userId })
    }
    catch {
      throw new Error('Post not found')
    }
    if (!post || post.businessId !== mcp.businessId) {
      throw new Error('Post not found')
    }

    return {
      postId: post.id,
      status: post.status,
      platforms: (post.platformPosts ?? []).map(pp => ({
        accountId: pp.socialAccountId,
        platformPostId: pp.platformPostId,
        status: pp.status,
        errorMessage: pp.errorMessage,
        publishedAt: pp.publishedAt instanceof Date ? pp.publishedAt.toISOString() : pp.publishedAt,
      })),
    }
  },
})
