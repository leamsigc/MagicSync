/**
 * GET /api/v1/stats/export
 * Export analytics as CSV for the given filters.
 * Query params:
 *   - businessId: filter by business
 *   - platform: filter by platform
 *   - days: number of days (default 30)
 */
import { analyticsService } from '#layers/BaseScheduler/server/services/Analytics.service'
import type { SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service'
import type { PlatformStatsFilters } from '#layers/BaseScheduler/server/services/PlatformStats.service'
import dayjs from 'dayjs'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const user = await checkUserIsLogin(event)
    const query = getQuery(event)
    const { businessId, platform, days = '30' } = query

    log.set({ userId: user.id, businessId, platform, days })

    const filters: PlatformStatsFilters = { userId: user.id }
    if (businessId) filters.businessId = businessId as string
    if (platform) filters.platform = platform as SocialMediaPlatform

    const csv = await analyticsService.exportCsv(filters, { days: parseInt(days as string) || 30 })

    event.node.res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    event.node.res.setHeader('Content-Disposition', `attachment; filename="magicsync-analytics-${dayjs().format('YYYY-MM-DD')}.csv"`)

    return csv
  } catch (error: unknown) {
    log.error({ content: 'Export stats error', error: String(error) })
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 500, statusMessage: 'Failed to export stats' })
  }
})