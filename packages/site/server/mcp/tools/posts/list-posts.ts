import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'List posts for the business bound to your API key, newest first. Supports status/format/date filters and pagination.',
  inputSchema: {
    status: z.enum(['pending', 'published', 'failed']).optional().describe('Filter by post status'),
    postFormat: z.enum(['post', 'reel', 'story', 'short']).optional().describe('Filter by format'),
    startDate: z.string().datetime().optional().describe('Only posts scheduled on/after this ISO datetime'),
    endDate: z.string().datetime().optional().describe('Only posts scheduled on/before this ISO datetime'),
    platform: z.string().optional().describe('Only posts targeting this platform (filters by connected account)'),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(10),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    // The service's LIKE platform filter matches against stored account IDs, not
    // platform names — so resolve the platform to account IDs and filter here.
    let accountIds: string[] | undefined
    if (args.platform) {
      const { socialMediaAccountService } = await import('#layers/BaseDB/server/services/social-media-account.service')
      const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(mcp.businessId)
      accountIds = accounts.filter(a => a.platform === args.platform).map(a => a.id)
      if (accountIds.length === 0) {
        return { posts: [], pagination: { page: args.page, limit: args.limit, total: 0, totalPages: 0 } }
      }
    }

    const result = await postService.findByBusinessId(mcp.businessId, userId, {
      pagination: { page: args.page, limit: args.limit },
      filters: {
        ...(args.status ? { status: args.status } : {}),
        ...(args.postFormat ? { postFormat: args.postFormat } : {}),
        ...(args.startDate ? { startDate: args.startDate } : {}),
        ...(args.endDate ? { endDate: args.endDate } : {}),
      },
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to list posts')
    }

    let posts = result.data
    if (accountIds) {
      const allowed = new Set(accountIds)
      posts = posts.filter(p => (p.platformPosts ?? []).some(pp => allowed.has(pp.socialAccountId)))
    }

    return {
      posts: posts.map(p => ({
        id: p.id,
        content: p.content.length > 200 ? `${p.content.slice(0, 200)}…` : p.content,
        status: p.status,
        postFormat: p.postFormat,
        scheduledAt: p.scheduledAt instanceof Date ? p.scheduledAt.toISOString() : p.scheduledAt,
        publishedAt: p.publishedAt instanceof Date ? p.publishedAt.toISOString() : p.publishedAt,
        platforms: (p.platformPosts ?? []).map(pp => ({ accountId: pp.socialAccountId, status: pp.status })),
      })),
      pagination: result.pagination,
    }
  },
})
