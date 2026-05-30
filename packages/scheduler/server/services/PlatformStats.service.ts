/**
 * Platform Stats Service
 *
 * Fetches platform statistics for all connected social media accounts,
 * saves daily snapshots as entityDetails, and provides historical data.
 *
 * @version 0.0.1
 */

import type { PlatformStats } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import type { SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service'
import type { SocialMediaAccount } from '#layers/BaseDB/db/schema'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { eq, and, desc, gte, inArray } from 'drizzle-orm'
import dayjs from 'dayjs'
import { AutoPostService } from './AutoPost.service'

const ENTITY_TYPE = 'platform_stats'
const SNAPSHOT_DAYS = 30 // Keep 30 days of historical snapshots

interface SnapshotRecord {
  id: string
  entityId: string
  entityType: string
  details: unknown
  createdAt: Date
  updatedAt: Date
}

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
  private async getLatestSnapshot(accountId: string): Promise<SnapshotRecord | null> {
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
   * Check if a new snapshot should be created (new day vs update existing)
   * Always create a new snapshot each day for 30-day history
   */
  private shouldCreateSnapshot(snapshot: SnapshotRecord | null): boolean {
    if (!snapshot) return true
    const snapshotDate = dayjs(snapshot.createdAt).format('YYYY-MM-DD')
    const today = dayjs().format('YYYY-MM-DD')
    return snapshotDate !== today
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
  private async saveSnapshot(accountId: string, stats: PlatformStats): Promise<{ id: string; created: boolean }> {
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
   * Fetch stats for a single social media account via AutoPostService
   */
  private autoPostService = new AutoPostService();

  async fetchAccountStats(account: SocialMediaAccount): Promise<{ stats: PlatformStats | null; error?: string }> {
    try {
      const stats = await this.autoPostService.getStatisticForAccount({
        platform: account.platform,
        account,
      });
      return { stats };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { data?: { error?: { message?: string } } } }
      const errorMessage = err.message || err.response?.data?.error?.message || String(error)
      console.error(`[PlatformStats] Failed to fetch stats for ${account.platform}/${account.accountId}:`, errorMessage)
      return { stats: null, error: errorMessage }
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
      const { stats, error } = await this.fetchAccountStats(account)
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
        const errorMessage = error || 'No plugin or API available'
        results.push({
          accountId: account.id,
          platform: account.platform,
          username: account.accountName,
          success: false,
          error: errorMessage,
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

    const accountIds: string[] = accounts.map((a: SocialMediaAccount) => a.id)

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

    return snapshots.map((s: SnapshotRecord) => {
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
    const byPlatform: Record<string, { platform: string; totalFollowers: number; totalPosts: number; totalEngagement: number; accounts: number }> = {}

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
