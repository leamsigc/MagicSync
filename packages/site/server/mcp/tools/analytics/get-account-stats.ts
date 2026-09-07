import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { analyticsService } from '#layers/BaseScheduler/server/services/Analytics.service'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'Follower/account stats collected from the networks: latest snapshot per account, or snapshot history over time (followers, following, posts, engagement). Collection is snapshot-based — MCP exposes what has been collected.',
  inputSchema: {
    platform: PLATFORMS.optional().describe('Only this platform'),
    accountId: z.string().optional().describe('Only this social account ID (see list-platforms)'),
    history: z.boolean().default(false).describe('Return snapshot history instead of latest snapshots'),
    startDate: z.string().datetime().optional().describe('History on/after this ISO datetime'),
    limit: z.number().int().min(1).max(100).default(20).describe('Max history points (history mode)'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()

    const filters = {
      businessId: mcp.businessId,
      ...(args.platform ? { platform: args.platform } : {}),
      ...(args.accountId ? { accountId: args.accountId } : {}),
      ...(args.startDate ? { startDate: args.startDate } : {}),
    }

    if (args.history) {
      const history = await analyticsService.getStatsHistory(filters, { startDate: args.startDate, limit: args.limit })
      return { mode: 'history', points: history }
    }

    const current = await analyticsService.getCurrentStats(filters)
    return { mode: 'current', accounts: current }
  },
})
