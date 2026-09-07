import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { requireMcp, resolveUserId } from '../utils/mcp-context'

/**
 * Calendar resource: all posts scheduled in a YYYY-MM month for the key-bound
 * business, all statuses. businessId is deliberately NOT a URI param — the key
 * is bound to exactly one business, so a param would only enable confusion.
 */
export default defineMcpResource({
  description: 'Scheduled-posts calendar for a month (YYYY-MM) for the key-bound business.',
  // ResourceTemplate (not a plain string): the MCP SDK only matches templated
  // URIs when given a template object — a string registers an exact literal.
  uri: new ResourceTemplate('magic-sync://calendar/{month}', { list: undefined }),
  enabled: event => !!event.context.mcp?.valid,
  async handler(uri: URL) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    const month = uri.pathname.replace(/^\//, '')
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error(`Invalid month "${month}" — use YYYY-MM, e.g. magic-sync://calendar/2026-09`)
    }
    const [y, mo] = month.split('-').map(Number)
    const startDate = new Date(Date.UTC(y, mo - 1, 1)).toISOString()
    const endDate = new Date(Date.UTC(y, mo, 1)).toISOString()

    const result = await postService.findByBusinessId(mcp.businessId, userId, {
      pagination: { page: 1, limit: 200 },
      filters: { startDate, endDate },
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to load calendar')
    }

    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          month,
          businessId: mcp.businessId,
          posts: result.data.map(p => ({
            id: p.id,
            content: p.content.length > 120 ? `${p.content.slice(0, 120)}…` : p.content,
            status: p.status,
            postFormat: p.postFormat,
            scheduledAt: p.scheduledAt instanceof Date ? p.scheduledAt.toISOString() : p.scheduledAt,
            platforms: (p.platformPosts ?? []).map(pp => pp.socialAccountId),
          })),
        }),
      }],
    }
  },
})
