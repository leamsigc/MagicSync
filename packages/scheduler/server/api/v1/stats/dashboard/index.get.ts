/**
 * GET /api/v1/stats/dashboard
 *
 * Dashboard overview with:
 * - Posts created in the last 30 days
 * - Total followers across all platforms
 * - Total engagement across all platforms
 * - Per-platform stats with 30-day time series for graphs
 *
 * Query params:
 *   - businessId: filter by business
 *   - days: number of days for historical data (default: 30)
 */
import { platformStatsService } from '#layers/BaseScheduler/server/services/PlatformStats.service'
import { postStatsService } from '#layers/BaseDB/server/services/post.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import dayjs from 'dayjs'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const user = await checkUserIsLogin(event)

    const query = getQuery(event)
    const { businessId, days = '30' } = query
    const daysNum = parseInt(days as string) || 30

    log.set({ userId: user.id, businessId, days: daysNum })

    const filters: any = { userId: user.id }
    if (businessId) filters.businessId = businessId as string

    const startDate = dayjs().subtract(daysNum, 'day').toISOString()

    const [postsCount, currentStats, timeSeries, connectedAccounts] = await Promise.all([
      postStatsService.countPosts({
        userId: user.id,
        businessId: businessId as string | undefined,
        startDate,
      }),
      platformStatsService.getCurrentStats(filters),
      platformStatsService.getStatsHistory(filters, { limit: 500 }),
      socialMediaAccountService.getAccounts({
        userId: user.id,
        businessId: businessId as string | undefined,
        isActive: true,
      }),
    ])

    const totalFollowers = currentStats.reduce((sum, s) => sum + (s.followers ?? 0), 0)
    const totalEngagement = currentStats.reduce((sum, s) => sum + (s.engagement?.total ?? 0), 0)
    const totalPosts = currentStats.reduce((sum, s) => sum + (s.posts ?? 0), 0)

    const platformSnapshots = buildPlatformSnapshots(timeSeries, daysNum)

    const hasCollectedStats = currentStats.length > 0
    const platformGraphs = hasCollectedStats && platformSnapshots.length > 0
      ? platformSnapshots
      : buildConnectedPlatforms(connectedAccounts)

    return {
      success: true,
      data: {
        summary: {
          postsLast30Days: postsCount,
          totalFollowers,
          totalEngagement,
          totalPosts,
        },
        currentStats: currentStats.map(s => ({
          platform: s.platform,
          accountId: s.accountId,
          username: s.username,
          followers: s.followers,
          following: s.following,
          posts: s.posts,
          engagement: s.engagement,
          growth: s.growth,
          extra: s.extra,
        })),
        platformGraphs,
      },
    }
  } catch (error: any) {
    log.error({ content: 'Dashboard stats error', error: String(error) })
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch dashboard stats' })
  }
})

function buildConnectedPlatforms(
  accounts: Array<{ id: string; platform: string; accountName?: string }>
) {
  return accounts.map(account => ({
    platform: account.platform,
    accountId: account.id,
    accountName: account.accountName || account.id,
    labels: [] as string[],
    followers: [] as number[],
    posts: [] as number[],
    engagement: [] as number[],
    current: {
      followers: 0,
      following: 0,
      posts: 0,
      engagement: 0,
    },
  }))
}

function buildPlatformSnapshots(
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
    accountId: string
    accountName: string
    labels: string[]
    followers: number[]
    posts: number[]
    engagement: number[]
    lastSnapshot: {
      followers: number
      following: number
      posts: number
      engagement: number
    }
  }>()

  const cutoff = dayjs().subtract(daysNum, 'day').format('YYYY-MM-DD')

  for (const point of history) {
    if (!point.platform) continue
    if (point.date < cutoff) continue

    const key = `${point.platform}-${point.accountId || 'default'}`

    if (!platformMap.has(key)) {
      platformMap.set(key, {
        platform: point.platform,
        accountId: point.accountId || '',
        accountName: point.username || point.accountId || 'Unknown',
        labels: [],
        followers: [],
        posts: [],
        engagement: [],
        lastSnapshot: { followers: 0, following: 0, posts: 0, engagement: 0 },
      })
    }

    const entry = platformMap.get(key)!
    entry.labels.push(dayjs(point.date).format('MMM D'))
    entry.followers.push(point.followers ?? 0)
    entry.posts.push(point.posts ?? 0)
    entry.engagement.push(point.totalEngagement ?? 0)
    entry.lastSnapshot = {
      followers: point.followers ?? 0,
      following: point.following ?? 0,
      posts: point.posts ?? 0,
      engagement: point.totalEngagement ?? 0,
    }
  }

  return Array.from(platformMap.values()).map(p => ({
    platform: p.platform,
    accountId: p.accountId,
    accountName: p.accountName,
    labels: p.labels,
    followers: p.followers,
    posts: p.posts,
    engagement: p.engagement,
    current: p.lastSnapshot,
  }))
}
