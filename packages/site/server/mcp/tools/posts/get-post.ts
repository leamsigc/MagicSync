import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'Get full details of a single post: content, status, schedule, per-platform publish state, and attached assets.',
  inputSchema: {
    postId: z.string().describe('ID of the post'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    // findByIdFull resolves via the org-member path, so any same-business post is
    // visible. The key-binding check below keeps it scoped to the key's business.
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
    return post
  },
})
