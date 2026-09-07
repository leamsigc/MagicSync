import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'
import { postStatsService } from '#layers/BaseDB/server/services/post-stats.service'
import { analyticsService } from '#layers/BaseScheduler/server/services/Analytics.service'
import { requireMcp, resolveUserId } from '../utils/mcp-context'

export default defineMcpResource({
  description: 'Analytics overview for the key-bound business: posting activity + latest per-account network stats.',
  uri: 'magic-sync://analytics/summary',
  enabled: event => !!event.context.mcp?.valid,
  async handler(uri: URL) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    const [postStats, accountStats] = await Promise.all([
      postStatsService.getPostStats(mcp.businessId, userId, {}),
      analyticsService.getCurrentStats({ businessId: mcp.businessId }),
    ])
    if (!postStats.success || !postStats.data) {
      throw new Error(postStats.error || 'Failed to load analytics summary')
    }

    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          businessId: mcp.businessId,
          posts: postStats.data,
          accounts: accountStats,
        }),
      }],
    }
  },
})
