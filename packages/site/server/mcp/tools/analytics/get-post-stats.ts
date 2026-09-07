import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postStatsService } from '#layers/BaseDB/server/services/post-stats.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'Posting activity stats for the business: totals by status, per-account breakdown, recent activity (published today, scheduled next 7 days, failed last 24h), and publish success rate. Same numbers as the dashboard stats cards.',
  inputSchema: {
    startDate: z.string().datetime().optional().describe('Only posts created on/after this ISO datetime'),
    endDate: z.string().datetime().optional().describe('Only posts created on/before this ISO datetime'),
    timezone: z.string().default('UTC').describe('IANA timezone for day-boundary math (e.g. Europe/Berlin)'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    // Known v1 limitation (tracked in PRD): findByBusinessId hard-filters by
    // userId, so org-level keys only see the fallback owner's posts.
    const result = await postStatsService.getPostStats(mcp.businessId, userId, {
      ...(args.startDate ? { startDate: args.startDate } : {}),
      ...(args.endDate ? { endDate: args.endDate } : {}),
      timezone: args.timezone,
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to calculate post statistics')
    }
    return result.data
  },
})
