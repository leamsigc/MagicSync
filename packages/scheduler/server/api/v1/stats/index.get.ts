/**
 * GET /api/v1/stats
 * Get current platform stats with filters
 * Query params:
 *   - businessId: filter by business
 *   - platform: filter by platform
 *   - accountId: filter by specific account
 *   - startDate: filter by snapshot date (ISO string)
 *   - endDate: filter by snapshot date (ISO string)
 *   - mode: 'current' | 'aggregated' | 'timeseries' | 'history' | 'comparison' | 'post-metrics' | 'top-posts'
 *   - days: number of days for timeseries/comparison/top-posts (default: 30, supports 7/30/90)
 *   - metric: 'followers' | 'posts' | 'engagement' for timeseries
 *   - limit: history/top-posts pagination limit (default: 100/10)
 */
import { analyticsService } from '#layers/BaseScheduler/server/services/Analytics.service'
import type { SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service'
import type { PlatformStatsFilters } from '#layers/BaseScheduler/server/services/PlatformStats.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const session = await getUserSessionFromEvent(event)
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const query = getQuery(event)
    const {
      businessId,
      platform,
      accountId,
      startDate,
      endDate,
      mode = 'current',
      days,
      metric,
      limit,
      offset,
    } = query

    log.set({ userId: session.user.id, businessId, platform, mode })

    const filters: PlatformStatsFilters = { userId: session.user.id }
    if (businessId) filters.businessId = businessId as string
    if (platform) filters.platform = platform as SocialMediaPlatform
    if (accountId) filters.accountId = accountId as string
    if (startDate) filters.startDate = startDate as string
    if (endDate) filters.endDate = endDate as string

    const daysNum = days ? parseInt(days as string) : 30

    let data: unknown

    switch (mode) {
      case 'aggregated': {
        data = await analyticsService.getAggregatedByPlatform(filters)
        break
      }
      case 'timeseries': {
        const allowedMetrics = ['followers', 'posts', 'engagement'] as const
        const metricParam = allowedMetrics.includes(metric as typeof allowedMetrics[number])
          ? (metric as typeof allowedMetrics[number])
          : undefined
        data = await analyticsService.getTimeSeriesData({ ...filters, metric: metricParam }, { days: daysNum })
        break
      }
      case 'history': {
        data = await analyticsService.getStatsHistory(filters, {
          limit: limit ? parseInt(limit as string) : 100,
          offset: offset ? parseInt(offset as string) : 0,
        })
        break
      }
      case 'comparison': {
        data = await analyticsService.getComparison(filters, daysNum)
        break
      }
      case 'post-metrics': {
        data = await analyticsService.getPostMetricsHistory({ ...filters, postId: (query.postId as string) || undefined })
        break
      }
      case 'top-posts': {
        data = await analyticsService.getTopPosts(filters, { days: daysNum, limit: limit ? parseInt(limit as string) : 10 })
        break
      }
      default: {
        // 'current' — latest snapshot per account
        data = await analyticsService.getCurrentStats(filters)
      }
    }

    return { success: true, data }
  } catch (error: unknown) {
    log.error({ content: 'Get stats error', error: String(error) })
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch stats' })
  }
})
