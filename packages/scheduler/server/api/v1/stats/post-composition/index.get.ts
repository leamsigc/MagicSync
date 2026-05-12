/**
 * GET /api/v1/stats/post-composition
 *
 * Returns aggregated stats data for AI post composition.
 * Helps the AI understand which platforms perform best and what metrics to target.
 *
 * Response shape:
 *   - platformPerformance: ranked by engagement
 *   - topContent: best performing posts per platform
 *   - targetMetrics: suggested targets for new content
 */
import { platformStatsService } from '#layers/BaseScheduler/server/services/PlatformStats.service'
import { postService } from '#layers/BaseDB/server/services/post.service'
import type { SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service'
import dayjs from 'dayjs'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const session = await getUserSessionFromEvent(event)
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const query = getQuery(event)
    const { businessId, days = '30' } = query
    const daysNum = parseInt(days as string) || 30

    log.set({ userId: session.user.id, businessId, days: daysNum })

    const filters: any = { userId: session.user.id }
    if (businessId) filters.businessId = businessId as string

    const startDate = dayjs().subtract(daysNum, 'day').toISOString()

    const [currentStats, timeSeries] = await Promise.all([
      platformStatsService.getCurrentStats(filters),
      platformStatsService.getStatsHistory(filters, { limit: 500 }),
    ])

    const platformPerformance = currentStats
      .map(s => ({
        platform: s.platform,
        username: s.username,
        followers: s.followers ?? 0,
        engagement: s.engagement?.total ?? 0,
        engagementRate: s.followers ? ((s.engagement?.total ?? 0) / s.followers) : 0,
        posts: s.posts ?? 0,
        growth: s.growth,
      }))
      .sort((a, b) => b.engagement - a.engagement)

    const topPlatform = platformPerformance[0] || null

    const targetMetrics = topPlatform
      ? {
          targetPlatform: topPlatform.platform,
          targetFollowers: topPlatform.followers,
          targetEngagement: topPlatform.engagement,
          suggestedEngagementRate: Math.round(topPlatform.engagementRate * 100) / 100,
        }
      : null

    const platformTrends = buildPlatformTrends(timeSeries, daysNum)

    return {
      success: true,
      data: {
        platformPerformance,
        topPlatform,
        targetMetrics,
        platformTrends,
        totalFollowers: currentStats.reduce((sum, s) => sum + (s.followers ?? 0), 0),
        totalEngagement: currentStats.reduce((sum, s) => sum + (s.engagement?.total ?? 0), 0),
        period: { days: daysNum, startDate, endDate: dayjs().toISOString() },
      },
    }
  } catch (error: any) {
    log.error({ content: 'Post composition stats error', error: String(error) })
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch post composition stats' })
  }
})

function buildPlatformTrends(
  history: Array<{
    date: string
    followers: number
    following: number
    posts: number
    totalEngagement: number
    platform?: string
    accountId?: string
    username?: string
  }>,
  daysNum: number
) {
  const platformMap = new Map<string, {
    platform: string
    followerTrend: number[]
    engagementTrend: number[]
    peakFollowers: { value: number; date: string }
    peakEngagement: { value: number; date: string }
  }>()

  const cutoff = dayjs().subtract(daysNum, 'day').format('YYYY-MM-DD')

  for (const point of history) {
    if (!point.platform) continue
    if (point.date < cutoff) continue

    if (!platformMap.has(point.platform)) {
      platformMap.set(point.platform, {
        platform: point.platform,
        followerTrend: [],
        engagementTrend: [],
        peakFollowers: { value: 0, date: '' },
        peakEngagement: { value: 0, date: '' },
      })
    }

    const entry = platformMap.get(point.platform)!

    entry.followerTrend.push(point.followers ?? 0)
    entry.engagementTrend.push(point.totalEngagement ?? 0)

    if ((point.followers ?? 0) > entry.peakFollowers.value) {
      entry.peakFollowers = { value: point.followers ?? 0, date: point.date }
    }
    if ((point.totalEngagement ?? 0) > entry.peakEngagement.value) {
      entry.peakEngagement = { value: point.totalEngagement ?? 0, date: point.date }
    }
  }

  return Array.from(platformMap.values()).map(p => ({
    platform: p.platform,
    followerTrend: p.followerTrend,
    engagementTrend: p.engagementTrend,
    peakFollowers: p.peakFollowers,
    peakEngagement: p.peakEngagement,
  }))
}
