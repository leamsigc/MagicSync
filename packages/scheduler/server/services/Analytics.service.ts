import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import dayjs from 'dayjs'
import type { SocialMediaAccount } from '#layers/BaseDB/db/schema'
import { accountMetrics, postMetrics, statsSyncState } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import type { PlatformStatsFilters } from './PlatformStats.service'

export interface AnalyticsCurrentStats {
  platform: string
  accountId: string
  username: string
  picture?: string
  lastCollectedAt: string
  followers?: number
  following?: number
  posts?: number
  engagement?: Record<string, number>
  growth?: { followers?: { absolute: number; percentage: number }; following?: { absolute: number; percentage: number }; posts?: { absolute: number; percentage: number }; engagement?: { absolute: number; percentage: number } }
  extra?: Record<string, unknown>
  raw: Record<string, unknown>
}

export interface AnalyticsHistoryPoint {
  date: string
  collectedAt: string
  followers: number
  following: number
  posts: number
  totalEngagement: number
  platform?: string
  accountId?: string
  username?: string
  picture?: string
}

export interface AnalyticsDelta {
  absolute: number
  percentage: number
}

export interface ComparisonEntry {
  platform: string
  accountId: string
  username: string
  current: { followers: number; following: number; posts: number; engagement: number }
  previous: { followers: number; following: number; posts: number; engagement: number }
  delta: {
    followers: AnalyticsDelta
    following: AnalyticsDelta
    posts: AnalyticsDelta
    engagement: AnalyticsDelta
  }
}

export interface TopPostEntry {
  postId: string
  content: string
  platform: string
  accountId: string
  externalPostId?: string
  metrics: Record<string, number>
  lastCollectedAt: string
}

export interface BestTimeSlot {
  platform: string
  dayOfWeek: number
  hour: number
  avgEngagement: number
  postCount: number
}

export interface BestTimesResult {
  slots: BestTimeSlot[]
  topSlots: BestTimeSlot[]
  timezoneNote: string
}

export interface PostMetricsPoint {
  collectedAt: string
  status: string
  metrics: Record<string, number>
  platform?: string
  platformPostId?: string
  socialAccountId?: string
  externalPostId?: string
  error?: string
}

export interface FreshnessEntry {
  accountId: string
  platform: string
  accountName: string
  lastCollectedAt?: string
  nextDueAt?: string
  status: string
  consecutiveFailures: number
  lastError?: string
}

export function toEngagementRecord(row: typeof accountMetrics.$inferSelect): Record<string, number> {
  const engagement = row.engagement as Record<string, number> | null
  const merged: Record<string, number> = {}
  if (engagement && typeof engagement === 'object') {
    for (const [key, value] of Object.entries(engagement)) {
      if (typeof value === 'number') merged[key] = value
    }
  }
  const total = merged.total ?? (merged.likes ?? 0) + (merged.comments ?? 0) + (merged.shares ?? 0)
  if (total > 0) merged.total = total
  return merged
}

function calcDelta(current: number, previous: number): AnalyticsDelta {
  const absolute = current - previous
  const percentage = previous > 0 ? Math.round((absolute / previous) * 10000) / 100 : 0
  return { absolute, percentage }
}

export class AnalyticsService {
  private db = useDrizzle()

  private async resolveAccounts(filters: PlatformStatsFilters = {}): Promise<SocialMediaAccount[]> {
    return socialMediaAccountService.getAccounts({
      userId: filters.userId,
      businessId: filters.businessId,
      platform: filters.platform,
      isActive: true,
    })
  }

  async getCurrentStats(filters: PlatformStatsFilters = {}): Promise<AnalyticsCurrentStats[]> {
    const accounts = await this.resolveAccounts(filters)
    const entries: AnalyticsCurrentStats[] = []
    for (const account of accounts) {
      const row = await this.db.query.accountMetrics.findFirst({
        where: and(eq(accountMetrics.socialAccountId, account.id), eq(accountMetrics.status, 'success')),
        orderBy: desc(accountMetrics.collectedAt),
      })
      if (!row) continue
      const raw = (row.rawPayload as Record<string, unknown>) ?? {}
      entries.push({
        platform: row.platform,
        accountId: account.id,
        username: (raw.username as string) ?? account.accountName,
        picture: raw.picture as string | undefined,
        lastCollectedAt: row.collectedAt.toISOString(),
        followers: row.followers ?? undefined,
        following: row.following ?? undefined,
        posts: row.posts ?? undefined,
        engagement: toEngagementRecord(row),
        growth: raw.growth as AnalyticsCurrentStats['growth'],
        extra: raw.extra as Record<string, unknown> | undefined,
        raw,
      })
    }
    return entries
  }

  async getStatsHistory(
    filters: PlatformStatsFilters = {},
    options: { startDate?: string; endDate?: string; limit?: number; offset?: number } = {}
  ): Promise<AnalyticsHistoryPoint[]> {
    const accounts = await this.resolveAccounts(filters)
    if (accounts.length === 0) return []
    const accountIds = accounts.map(a => a.id)
    const conditions = [inArray(accountMetrics.socialAccountId, accountIds)]
    if (options.startDate) conditions.push(gte(accountMetrics.collectedAt, dayjs(options.startDate).toDate()))
    if (options.endDate) conditions.push(lt(accountMetrics.collectedAt, dayjs(options.endDate).add(1, 'day').toDate()))
    if (filters.accountId) conditions.push(eq(accountMetrics.socialAccountId, filters.accountId))
    const rows = await this.db.query.accountMetrics.findMany({
      where: and(...conditions),
      orderBy: desc(accountMetrics.collectedAt),
      limit: options.limit || 500,
      offset: options.offset || 0,
    })
    const accountNameById = new Map(accounts.map(a => [a.id, a.accountName]))
    return rows.map((row) => {
      const raw = (row.rawPayload as Record<string, unknown>) ?? {}
      const engagement = toEngagementRecord(row)
      return {
        date: dayjs(row.collectedAt).format('YYYY-MM-DD'),
        collectedAt: row.collectedAt.toISOString(),
        followers: row.followers ?? 0,
        following: row.following ?? 0,
        posts: row.posts ?? 0,
        totalEngagement: engagement.total ?? 0,
        platform: row.platform,
        accountId: row.socialAccountId,
        username: (raw.username as string) ?? accountNameById.get(row.socialAccountId) ?? '',
        picture: raw.picture as string | undefined,
      }
    })
  }

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
        byPlatform[s.platform] = { platform: s.platform, totalFollowers: 0, totalPosts: 0, totalEngagement: 0, accounts: 0 }
      }
      byPlatform[s.platform].totalFollowers += s.followers ?? 0
      byPlatform[s.platform].totalPosts += s.posts ?? 0
      byPlatform[s.platform].totalEngagement += s.engagement?.total ?? 0
      byPlatform[s.platform].accounts += 1
    }
    return byPlatform
  }

  async getTimeSeriesData(
    filters: PlatformStatsFilters & { metric?: 'followers' | 'posts' | 'engagement' } = {},
    options: { days?: number } = {}
  ): Promise<{ labels: string[]; datasets: { platform: string; data: number[] }[] }> {
    const days = options.days || 30
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD')
    const history = await this.getStatsHistory(filters, { startDate, limit: 500 })
    const dateMap = new Map<string, Map<string, number>>()
    for (const point of history) {
      if (!dateMap.has(point.date)) dateMap.set(point.date, new Map())
      const platformMap = dateMap.get(point.date)!
      const metric = filters.metric || 'followers'
      const value = metric === 'followers' ? point.followers
        : metric === 'posts' ? point.posts
          : point.totalEngagement
      if (point.platform) platformMap.set(point.platform, value)
    }
    const dates = Array.from(dateMap.keys()).sort()
    const platforms = [...new Set(history.map(h => h.platform).filter(Boolean))] as string[]
    const labels = dates.map(d => dayjs(d).format('MMM D'))
    const datasets = platforms.map(platform => ({
      platform,
      data: dates.map(date => dateMap.get(date)?.get(platform) ?? 0),
    }))
    return { labels, datasets }
  }

  async getComparison(filters: PlatformStatsFilters = {}, days = 30): Promise<{ days: number; entries: ComparisonEntry[] }> {
    const accounts = await this.resolveAccounts(filters)
    const start = dayjs().startOf('day')
    const windowStart = start.subtract(days, 'day')
    const previousStart = windowStart.subtract(days, 'day')
    const entries: ComparisonEntry[] = []
    for (const account of accounts) {
      const current = await this.db.query.accountMetrics.findFirst({
        where: and(eq(accountMetrics.socialAccountId, account.id), eq(accountMetrics.status, 'success'), gte(accountMetrics.collectedAt, windowStart.toDate())),
        orderBy: desc(accountMetrics.collectedAt),
      })
      const previous = await this.db.query.accountMetrics.findFirst({
        where: and(eq(accountMetrics.socialAccountId, account.id), eq(accountMetrics.status, 'success'), gte(accountMetrics.collectedAt, previousStart.toDate()), lt(accountMetrics.collectedAt, windowStart.toDate())),
        orderBy: desc(accountMetrics.collectedAt),
      })
      const cEng = current ? toEngagementRecord(current) : {}
      const pEng = previous ? toEngagementRecord(previous) : {}
      const currentVal = { followers: current?.followers ?? 0, following: current?.following ?? 0, posts: current?.posts ?? 0, engagement: cEng.total ?? 0 }
      const previousVal = { followers: previous?.followers ?? 0, following: previous?.following ?? 0, posts: previous?.posts ?? 0, engagement: pEng.total ?? 0 }
      entries.push({
        platform: account.platform,
        accountId: account.id,
        username: account.accountName,
        current: currentVal,
        previous: previousVal,
        delta: {
          followers: calcDelta(currentVal.followers, previousVal.followers),
          following: calcDelta(currentVal.following, previousVal.following),
          posts: calcDelta(currentVal.posts, previousVal.posts),
          engagement: calcDelta(currentVal.engagement, previousVal.engagement),
        },
      })
    }
    return { days, entries }
  }

  async getTopPosts(filters: PlatformStatsFilters = {}, options: { days?: number; limit?: number } = {}): Promise<TopPostEntry[]> {
    const accounts = await this.resolveAccounts(filters)
    if (accounts.length === 0) return []
    const days = options.days || 30
    const limit = options.limit || 10
    const since = dayjs().subtract(days, 'day').toDate()
    const accountIds = accounts.map(a => a.id)
    const rows = await this.db.query.postMetrics.findMany({
      where: and(inArray(postMetrics.socialAccountId, accountIds), eq(postMetrics.status, 'success'), gte(postMetrics.collectedAt, since)),
      orderBy: desc(postMetrics.collectedAt),
      limit: 1000,
      with: { post: true },
    })
    const latestByPost = new Map<string, typeof rows[number]>()
    for (const row of rows) {
      if (!row.post) continue
      if (!latestByPost.has(row.postId)) latestByPost.set(row.postId, row)
    }
    const postTotal = (row: typeof rows[number]): number => {
      const metrics = row.metrics as Record<string, number> | null
      return metrics?.total ?? 0
    }
    return Array.from(latestByPost.values())
      .sort((a, b) => postTotal(b) - postTotal(a))
      .slice(0, limit)
      .map(row => ({
        postId: row.postId,
        content: row.post!.content ?? '',
        platform: row.platform,
        accountId: row.socialAccountId,
        externalPostId: row.externalPostId || undefined,
        metrics: row.metrics as Record<string, number>,
        lastCollectedAt: row.collectedAt.toISOString(),
      }))
  }

  async getBestTimes(filters: PlatformStatsFilters = {}, options: { days?: number } = {}): Promise<BestTimesResult> {
    const accounts = await this.resolveAccounts(filters)
    if (accounts.length === 0) return { slots: [], topSlots: [], timezoneNote: 'UTC' }
    const days = options.days || 90
    const since = dayjs().subtract(days, 'day').toDate()
    const scoped = filters.accountId ? accounts.filter(a => a.id === filters.accountId) : accounts
    const accountIds = scoped.map(a => a.id)
    if (accountIds.length === 0) return { slots: [], topSlots: [], timezoneNote: 'UTC' }
    const rows = await this.db.query.postMetrics.findMany({
      where: and(inArray(postMetrics.socialAccountId, accountIds), eq(postMetrics.status, 'success'), gte(postMetrics.collectedAt, since)),
      orderBy: desc(postMetrics.collectedAt),
      limit: 2000,
      with: { post: true },
    })
    // Latest snapshot per post, then bucket by publish hour (UTC)
    const latestByPost = new Map<string, typeof rows[number]>()
    for (const row of rows) {
      if (!row.post) continue
      if (!latestByPost.has(row.postId)) latestByPost.set(row.postId, row)
    }
    const buckets = new Map<string, { platform: string; dayOfWeek: number; hour: number; total: number; count: number }>()
    for (const row of latestByPost.values()) {
      const metrics = row.metrics as Record<string, number> | null
      const engagement = metrics?.total ?? 0
      const publishedAt = row.post!.publishedAt ?? row.post!.scheduledAt ?? row.collectedAt
      const date = new Date(publishedAt)
      const key = `${row.platform}|${date.getUTCDay()}|${date.getUTCHours()}`
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.total += engagement
        bucket.count += 1
      } else {
        buckets.set(key, { platform: row.platform, dayOfWeek: date.getUTCDay(), hour: date.getUTCHours(), total: engagement, count: 1 })
      }
    }
    const slots: BestTimeSlot[] = Array.from(buckets.values())
      .map(b => ({ platform: b.platform, dayOfWeek: b.dayOfWeek, hour: b.hour, avgEngagement: Math.round((b.total / b.count) * 100) / 100, postCount: b.count }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
    // Top slots need at least 2 posts to avoid single-post outliers
    const topSlots = slots.filter(s => s.postCount >= 2).slice(0, 5)
    return { slots, topSlots, timezoneNote: 'UTC' }
  }

  async getPostMetricsHistory(filters: PlatformStatsFilters & { postId?: string; platformPostId?: string } = {}): Promise<PostMetricsPoint[]> {
    const conditions = []
    if (filters.userId || filters.businessId) {
      const accounts = await this.resolveAccounts(filters)
      const scoped = filters.accountId ? accounts.filter(a => a.id === filters.accountId) : accounts
      const accountIds = scoped.map(a => a.id)
      if (accountIds.length === 0) return []
      conditions.push(inArray(postMetrics.socialAccountId, accountIds))
    } else if (filters.accountId) {
      conditions.push(eq(postMetrics.socialAccountId, filters.accountId))
    }
    if (filters.postId) conditions.push(eq(postMetrics.postId, filters.postId))
    if (filters.platform) conditions.push(eq(postMetrics.platform, filters.platform))
    if (filters.platformPostId) conditions.push(eq(postMetrics.platformPostId, filters.platformPostId))
    const rows = await this.db.query.postMetrics.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: asc(postMetrics.collectedAt),
      limit: 1000,
    })
    return rows.map(row => ({
      collectedAt: row.collectedAt.toISOString(),
      status: row.status,
      metrics: row.metrics as Record<string, number>,
      platform: row.platform,
      platformPostId: row.platformPostId,
      socialAccountId: row.socialAccountId,
      externalPostId: row.externalPostId || undefined,
      error: row.error || undefined,
    }))
  }

  async getFreshness(filters: PlatformStatsFilters = {}): Promise<FreshnessEntry[]> {
    const accounts = await this.resolveAccounts(filters)
    const entries: FreshnessEntry[] = []
    for (const account of accounts) {
      const sync = await this.db.query.statsSyncState.findFirst({
        where: eq(statsSyncState.socialAccountId, account.id),
      })
      const latest = await this.db.query.accountMetrics.findFirst({
        where: and(eq(accountMetrics.socialAccountId, account.id), eq(accountMetrics.status, 'success')),
        orderBy: desc(accountMetrics.collectedAt),
      })
      entries.push({
        accountId: account.id,
        platform: account.platform,
        accountName: account.accountName,
        lastCollectedAt: latest?.collectedAt.toISOString(),
        nextDueAt: sync?.nextDueAt?.toISOString(),
        status: sync?.status ?? 'idle',
        consecutiveFailures: sync?.consecutiveFailures ?? 0,
        lastError: sync?.lastError ?? undefined,
      })
    }
    return entries
  }

  async exportCsv(filters: PlatformStatsFilters = {}, options: { days?: number } = {}): Promise<string> {
    const days = options.days || 30
    const startDate = dayjs().subtract(days, 'day').toISOString()
    const history = await this.getStatsHistory(filters, { startDate, limit: 1000 })
    const escape = (value: unknown): string => {
      const text = value === null || value === undefined ? '' : String(value)
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const header = ['date', 'platform', 'accountId', 'username', 'followers', 'following', 'posts', 'engagement']
    const lines = [
      header.join(','),
      ...history.map(point => [
        point.date,
        point.platform ?? '',
        point.accountId ?? '',
        point.username ?? '',
        point.followers,
        point.following,
        point.posts,
        point.totalEngagement,
      ].map(escape).join(',')),
    ]
    return lines.join('\n')
  }
}

export const analyticsService = new AnalyticsService()
