/**
 * Platform Stats Service
 *
 * Fetches platform statistics for all connected social media accounts,
 * saves daily snapshots as entityDetails, and provides historical data.
 *
 * @version 0.0.1
 */

import type { PlatformStats } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import type { PluginPostDetails, PluginSocialMediaAccount } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import type { SchedulerPluginConstructor } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import { socialMediaAccountService, type SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { eq, and, desc, gte, inArray, sql } from 'drizzle-orm'
import dayjs from 'dayjs'

// Plugin imports (same matcher as AutoPostService)
import { FacebookPlugin } from '#layers/BaseScheduler/server/services/plugins/facebook.plugin'
import { BlueskyPlugin } from '#layers/BaseScheduler/server/services/plugins/bluesky.plugin'
import { DevToPlugin } from '#layers/BaseScheduler/server/services/plugins/devto.plugin'
import { DiscordPlugin } from '#layers/BaseScheduler/server/services/plugins/discord.plugin'
import { DribbblePlugin } from '#layers/BaseScheduler/server/services/plugins/dribbble.plugin'
import { GoogleMyBusinessPlugin } from '#layers/BaseScheduler/server/services/plugins/googlemybusiness.plugin'
import { InstagramPlugin } from '#layers/BaseScheduler/server/services/plugins/instagram.plugin'
import { InstagramStandalonePlugin } from '#layers/BaseScheduler/server/services/plugins/instagram-standalone.plugin'
import { LinkedInPlugin } from '#layers/BaseScheduler/server/services/plugins/linkedin.plugin'
import { LinkedInPagePlugin } from '#layers/BaseScheduler/server/services/plugins/linkedin-page.plugin'
import { RedditPlugin } from '#layers/BaseScheduler/server/services/plugins/reddit.plugin'
import { ThreadsPlugin } from '#layers/BaseScheduler/server/services/plugins/threads.plugin'
import { TikTokPlugin } from '#layers/BaseScheduler/server/services/plugins/tiktok.plugin'
import { WordPressPlugin } from '#layers/BaseScheduler/server/services/plugins/wordpress.plugin'
import { XPlugin } from '#layers/BaseScheduler/server/services/plugins/x.plugin'
import { YouTubePlugin } from '#layers/BaseScheduler/server/services/plugins/youtube.plugin'

const PLUGIN_MATCHER: Record<string, SchedulerPluginConstructor> = {
  facebook: FacebookPlugin as unknown as SchedulerPluginConstructor,
  bluesky: BlueskyPlugin as unknown as SchedulerPluginConstructor,
  devto: DevToPlugin as unknown as SchedulerPluginConstructor,
  discord: DiscordPlugin as unknown as SchedulerPluginConstructor,
  dribbble: DribbblePlugin as unknown as SchedulerPluginConstructor,
  googlemybusiness: GoogleMyBusinessPlugin as unknown as SchedulerPluginConstructor,
  instagram: InstagramPlugin as unknown as SchedulerPluginConstructor,
  'instagram-standalone': InstagramStandalonePlugin as unknown as SchedulerPluginConstructor,
  linkedin: LinkedInPlugin as unknown as SchedulerPluginConstructor,
  'linkedin-page': LinkedInPagePlugin as unknown as SchedulerPluginConstructor,
  reddit: RedditPlugin as unknown as SchedulerPluginConstructor,
  threads: ThreadsPlugin as unknown as SchedulerPluginConstructor,
  tiktok: TikTokPlugin as unknown as SchedulerPluginConstructor,
  wordpress: WordPressPlugin as unknown as SchedulerPluginConstructor,
  twitter: XPlugin as unknown as SchedulerPluginConstructor,
  youtube: YouTubePlugin as unknown as SchedulerPluginConstructor,
}

const ENTITY_TYPE = 'platform_stats'
const SNAPSHOT_DAYS = 7 // Only create new snapshot if older than 7 days

export interface StatsSnapshot {
  id: string
  entityId: string
  platform: string
  username: string
  followers: number
  following: number
  posts: number
  totalEngagement: number
  fetchedAt: string
}

export interface StatsHistoryPoint {
  date: string
  followers: number
  following: number
  posts: number
  totalEngagement: number
  platform?: string
  accountId?: string
  username?: string
  picture?: string
}

export interface PlatformStatsFilters {
  businessId?: string
  userId?: string
  platform?: SocialMediaPlatform
  accountId?: string
  startDate?: string
  endDate?: string
}

export interface CollectStatsResult {
  accountId: string
  platform: string
  username: string
  success: boolean
  stats?: PlatformStats
  error?: string
}

export class PlatformStatsService {
  private db = useDrizzle()

  /**
   * Get the latest stats snapshot for a social media account
   */
  private async getLatestSnapshot(accountId: string): Promise<any | null> {
    const result = await this.db.query.entityDetails.findFirst({
      where: and(
        eq(entityDetails.entityId, accountId),
        eq(entityDetails.entityType, ENTITY_TYPE)
      ),
      orderBy: desc(entityDetails.createdAt),
    })
    return result || null
  }

  /**
   * Check if a new snapshot should be created (older than SNAPSHOT_DAYS)
   */
  private shouldCreateSnapshot(snapshot: any): boolean {
    if (!snapshot) return true
    const createdAt = new Date(snapshot.createdAt)
    const cutoff = dayjs().subtract(SNAPSHOT_DAYS, 'day').toDate()
    return createdAt < cutoff
  }

  /**
   * Calculate growth metrics by comparing with the previous snapshot
   */
  private calculateGrowth(current: PlatformStats, previous: PlatformStats | null): PlatformStats['growth'] {
    if (!previous) return undefined

    const calc = (curr: number | undefined, prev: number | undefined) => {
      const c = curr ?? 0
      const p = prev ?? 0
      const abs = c - p
      const pct = p > 0 ? Math.round((abs / p) * 10000) / 100 : 0
      return { absolute: abs, percentage: pct }
    }

    return {
      followers: calc(current.followers, previous.followers),
      following: calc(current.following, previous.following),
      posts: calc(current.posts, previous.posts),
      engagement: calc(current.engagement?.total, previous.engagement?.total),
    }
  }

  /**
   * Save or update a stats snapshot for an account
   */
  private async saveSnapshot(accountId: string, stats: PlatformStats): Promise<any> {
    const latest = await this.getLatestSnapshot(accountId)

    if (this.shouldCreateSnapshot(latest)) {
      // Create new snapshot
      const id = crypto.randomUUID()
      const now = dayjs().toDate()
      await this.db.insert(entityDetails).values({
        id,
        entityId: accountId,
        entityType: ENTITY_TYPE,
        details: stats as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      })
      return { id, created: true }
    } else {
      // Update existing snapshot
      await this.db
        .update(entityDetails)
        .set({
          details: stats as unknown as Record<string, unknown>,
          updatedAt: dayjs().toDate(),
        })
        .where(eq(entityDetails.id, latest.id))
      return { id: latest.id, created: false }
    }
  }

  /**
   * Fetch stats for a single social media account via its plugin
   */
  async fetchAccountStats(account: any): Promise<PlatformStats | null> {
    const pluginClass = PLUGIN_MATCHER[account.platform]
    if (!pluginClass) return null

    const scheduler = new SchedulerPost({})
    scheduler.use(pluginClass)

    try {
      // Build a minimal PluginPostDetails (stats don't need a specific post)
      const dummyPost: PluginPostDetails = {
        id: '',
        title: '',
        message: '',
        settings: {},
        platformPosts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        userId: '',
        businessId: '',
      } as PluginPostDetails

      const socialAccount: PluginSocialMediaAccount = {
        ...account,
        metadata: account.metadata || {},
      } as PluginSocialMediaAccount

      const stats = await scheduler.getStatistic(dummyPost, socialAccount)
      return stats
    } catch (error) {
      console.error(`[PlatformStats] Failed to fetch stats for ${account.platform}/${account.accountId}:`, error)
      return null
    } finally {
      scheduler.destroy()
    }
  }

  /**
   * Collect stats for all accounts of a user/business
   */
  async collectAllStats(filters: PlatformStatsFilters = {}): Promise<CollectStatsResult[]> {
    const accounts = await socialMediaAccountService.getAccounts({
      userId: filters.userId,
      businessId: filters.businessId,
      platform: filters.platform,
      isActive: true,
    })

    const results: CollectStatsResult[] = []

    for (const account of accounts) {
      try {
        const stats = await this.fetchAccountStats(account)
        if (stats) {
          await this.saveSnapshot(account.id, stats)
          results.push({
            accountId: account.id,
            platform: account.platform,
            username: stats.username || account.accountName,
            success: true,
            stats,
          })
        } else {
          results.push({
            accountId: account.id,
            platform: account.platform,
            username: account.accountName,
            success: false,
            error: 'No plugin or API available',
          })
        }
      } catch (error: any) {
        results.push({
          accountId: account.id,
          platform: account.platform,
          username: account.accountName,
          success: false,
          error: error.message,
        })
      }
    }

    return results
  }

  /**
   * Get current (latest) stats for accounts with optional filters
   */
  async getCurrentStats(filters: PlatformStatsFilters = {}): Promise<PlatformStats[]> {
    const accounts = await socialMediaAccountService.getAccounts({
      userId: filters.userId,
      businessId: filters.businessId,
      platform: filters.platform,
      isActive: true,
    })

    const statsList: PlatformStats[] = []

    for (const account of accounts) {
      const snapshot = await this.getLatestSnapshot(account.id)
      if (snapshot) {
        const details = snapshot.details as unknown as PlatformStats

        // Apply date filter if provided
        if (filters.startDate || filters.endDate) {
          const snapshotDate = dayjs(snapshot.createdAt)
          if (filters.startDate && snapshotDate.isBefore(dayjs(filters.startDate))) continue
          if (filters.endDate && snapshotDate.isAfter(dayjs(filters.endDate))) continue
        }

        statsList.push(details)
      }
    }

    return statsList
  }

  /**
   * Get stats history (all snapshots) for accounts with optional filters
   */
  async getStatsHistory(
    filters: PlatformStatsFilters = {},
    options: { limit?: number; offset?: number } = {}
  ): Promise<StatsHistoryPoint[]> {
    const accounts = await socialMediaAccountService.getAccounts({
      userId: filters.userId,
      businessId: filters.businessId,
      platform: filters.platform,
      isActive: true,
    })

    if (accounts.length === 0) return []

    const accountIds: string[] = accounts.map((a: any) => a.id)

    const conditions = [
      eq(entityDetails.entityType, ENTITY_TYPE),
    ]

    if (filters.accountId) {
      conditions.push(eq(entityDetails.entityId, filters.accountId))
    } else if (accountIds.length > 0) {
      conditions.push(inArray(entityDetails.entityId, accountIds))
    }

    if (filters.startDate) {
      conditions.push(gte(entityDetails.createdAt, dayjs(filters.startDate).toDate()))
    }

    const snapshots = await this.db.query.entityDetails.findMany({
      where: and(...conditions),
      orderBy: desc(entityDetails.createdAt),
      limit: options.limit || 100,
      offset: options.offset || 0,
    })

    return snapshots.map((s: any) => {
      const details = s.details as unknown as PlatformStats
      return {
        date: dayjs(s.createdAt).format('YYYY-MM-DD'),
        followers: details.followers ?? 0,
        following: details.following ?? 0,
        posts: details.posts ?? 0,
        totalEngagement: details.engagement?.total ?? 0,
        platform: details.platform,
        accountId: details.accountId,
        username: details.username,
        picture: details.picture,
      }
    })
  }

  /**
   * Get aggregated stats per platform (total followers, posts, etc.)
   */
  async getAggregatedByPlatform(filters: PlatformStatsFilters = {}): Promise<Record<string, {
    platform: string
    totalFollowers: number
    totalPosts: number
    totalEngagement: number
    accounts: number
  }>> {
    const stats = await this.getCurrentStats(filters)
    const byPlatform: Record<string, any> = {}

    for (const s of stats) {
      if (!byPlatform[s.platform]) {
        byPlatform[s.platform] = {
          platform: s.platform,
          totalFollowers: 0,
          totalPosts: 0,
          totalEngagement: 0,
          accounts: 0,
        }
      }
      byPlatform[s.platform].totalFollowers += s.followers ?? 0
      byPlatform[s.platform].totalPosts += s.posts ?? 0
      byPlatform[s.platform].totalEngagement += s.engagement?.total ?? 0
      byPlatform[s.platform].accounts += 1
    }

    return byPlatform
  }

  /**
   * Get time-series data for a specific metric (for charts)
   */
  async getTimeSeriesData(
    filters: PlatformStatsFilters & { metric?: 'followers' | 'posts' | 'engagement' } = {},
    options: { days?: number; interval?: 'day' | 'week' } = {}
  ): Promise<{ labels: string[]; datasets: { platform: string; data: number[] }[] }> {
    const days = options.days || 30
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD')

    const history = await this.getStatsHistory({ ...filters, startDate }, { limit: 500 })

    // Group by date
    const dateMap = new Map<string, Map<string, number>>()
    for (const point of history) {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, new Map())
      }
      const platformMap = dateMap.get(point.date)!
      const metric = filters.metric || 'followers'
      const value = metric === 'followers' ? point.followers
        : metric === 'posts' ? point.posts
        : point.totalEngagement
      if (point.platform) {
        platformMap.set(point.platform, value)
      }
    }

    // Get all unique dates
    const dates = Array.from(dateMap.keys()).sort()
    const platforms = [...new Set(history.map(h => h.platform).filter(Boolean))] as string[]

    const labels = dates.map(d => dayjs(d).format('MMM D'))

    const datasets = platforms.map(platform => ({
      platform,
      data: dates.map(date => dateMap.get(date)?.get(platform) ?? 0),
    }))

    return { labels, datasets }
  }
}

export const platformStatsService = new PlatformStatsService()
