import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { requireMcp, resolveUserId } from '../utils/mcp-context'

export default defineMcpResource({
  description: 'Full details of a single post (content, status, schedule, per-platform state, assets). Key-business scoped.',
  // ResourceTemplate (not a plain string): the MCP SDK only matches templated
  // URIs when given a template object — a string registers an exact literal.
  uri: new ResourceTemplate('magic-sync://posts/{postId}', { list: undefined }),
  enabled: event => !!event.context.mcp?.valid,
  async handler(uri: URL) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    const postId = uri.pathname.replace(/^\//, '')
    if (!postId) {
      throw new Error('Missing postId — use magic-sync://posts/{postId}')
    }

    let post
    try {
      post = await postService.findByIdFull({ postId, userId })
    }
    catch {
      throw new Error('Post not found')
    }
    if (!post || post.businessId !== mcp.businessId) {
      throw new Error('Post not found')
    }

    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(post),
      }],
    }
  },
})
