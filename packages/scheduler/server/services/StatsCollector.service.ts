import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import dayjs from 'dayjs'
import type { Account, PlatformPost, PostWithAllData, SocialMediaAccount } from '#layers/BaseDB/db/schema'
import { accountMetrics, platformPosts, postMetrics, statsSyncState } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { AutoPostService } from './AutoPost.service'
import { platformStatsService } from './PlatformStats.service'
import type { PostInsight } from './SchedulerPost.service'
import { extractExternalPostId } from './SchedulerPost.service'
import { normalizePostInsights } from './stats-normalizer'
import type { PlatformStatsFilters, CollectStatsResult } from './PlatformStats.service'

export const ACCOUNT_INTERVAL_HOURS = Number(process.env.STATS_ACCOUNT_INTERVAL_HOURS || 6)
const RETRY_BASE_MINUTES = 15
const RETRY_MAX_MINUTES = 6 * 60

export interface CollectAllResult {
  accountsDue: number
  accountsCollected: number
  accountsFailed: number
  postsDue: number
  postsCollected: number
  postsFailed: number
  results: CollectStatsResult[]
}

interface DuePostItem {
  postFull: PostWithAllData
  platformPost: PlatformPost
  account: SocialMediaAccount
}

export function getAdaptivePostIntervalHour(publishedAt: Date): number {
  const ageHours = Math.max(0, dayjs().diff(dayjs(publishedAt), 'hour'))
  if (ageHours < 6) return 1
  if (ageHours < 24) return 3
  if (ageHours < 72) return 12
  if (ageHours < 168) return 24
  return 168
}

export class StatsCollectorService {
  private db = useDrizzle()
  private autoPostService = new AutoPostService()

  async ensureSyncState(accountId: string): Promise<void> {
    const existing = await this.db.query.statsSyncState.findFirst({
      where: eq(statsSyncState.socialAccountId, accountId),
    })
    if (!existing) {
      await this.db.insert(statsSyncState).values({
        id: crypto.randomUUID(),
        socialAccountId: accountId,
      })
    }
  }

  async getSyncState(accountId: string) {
    return this.db.query.statsSyncState.findFirst({
      where: eq(statsSyncState.socialAccountId, accountId),
    })
  }

  async updateSyncState(accountId: string, patch: Partial<typeof statsSyncState.$inferInsert>): Promise<void> {
    await this.db.update(statsSyncState)
      .set({ ...patch, socialAccountId: accountId })
      .where(eq(statsSyncState.socialAccountId, accountId))
  }

  async getDueAccounts(filters: PlatformStatsFilters = {}, opts: { force?: boolean } = {}): Promise<SocialMediaAccount[]> {
    const accounts = await socialMediaAccountService.getAccounts({
      userId: filters.userId,
      businessId: filters.businessId,
      platform: filters.platform,
      isActive: true,
    })
    if (opts.force) return accounts
    const due: SocialMediaAccount[] = []
    for (const account of accounts) {
      const sync = await this.getSyncState(account.id)
      if (!sync) { due.push(account); continue }
      if (sync.backoffUntil && dayjs(sync.backoffUntil).isAfter(dayjs())) continue
      if (!sync.nextDueAt || dayjs(sync.nextDueAt).isBefore(dayjs())) due.push(account)
    }
    return due
  }

  async collectAccount(account: SocialMediaAccount, source: 'auto' | 'manual' = 'auto'): Promise<CollectStatsResult> {
    await this.ensureSyncState(account.id)
    const now = dayjs().toDate()
    await this.updateSyncState(account.id, { lastAttemptAt: now, status: 'running' })
    const { stats, error } = await platformStatsService.fetchAccountStats(account)
    if (stats) {
      await this.db.insert(accountMetrics).values({
        id: crypto.randomUUID(),
        socialAccountId: account.id,
        platform: stats.platform || account.platform,
        followers: stats.followers ?? null,
        following: stats.following ?? null,
        posts: stats.posts ?? null,
        engagement: (stats.engagement as Record<string, unknown> | undefined) ?? null,
        rawPayload: stats,
        source,
        status: 'success',
        collectedAt: now,
      })
      await this.markSuccess(account.id, now)
      return {
        accountId: account.id,
        platform: stats.platform || account.platform,
        username: stats.username || account.accountName,
        success: true,
        stats,
      }
    }
    const errorMessage = error || 'No stats available for account'
    await this.markFailure(account.id, errorMessage)
    return {
      accountId: account.id,
      platform: account.platform,
      username: account.accountName,
      success: false,
      error: errorMessage,
    }
  }

  async markSuccess(accountId: string, at: Date = new Date()): Promise<void> {
    await this.updateSyncState(accountId, {
      lastSuccessAt: at,
      nextDueAt: dayjs(at).add(ACCOUNT_INTERVAL_HOURS, 'hour').toDate(),
      status: 'idle',
      consecutiveFailures: 0,
      lastError: null,
      backoffUntil: null,
    })
  }

  async markFailure(accountId: string, error: string): Promise<void> {
    const sync = await this.getSyncState(accountId)
    const failures = (sync?.consecutiveFailures ?? 0) + 1
    const delayMinutes = Math.min(RETRY_BASE_MINUTES * 2 ** (failures - 1), RETRY_MAX_MINUTES)
    const backoffUntil = dayjs().add(delayMinutes, 'minute').toDate()
    await this.updateSyncState(accountId, {
      consecutiveFailures: failures,
      status: 'error',
      lastError: error,
      backoffUntil,
      nextDueAt: backoffUntil,
    })
  }

  private async getLatestPostMetric(platformPostId: string) {
    return this.db.query.postMetrics.findFirst({
      where: eq(postMetrics.platformPostId, platformPostId),
      orderBy: desc(postMetrics.collectedAt),
    })
  }

  private isPostDue(platformPost: PlatformPost, latest: { collectedAt: Date } | undefined): boolean {
    if (!latest) return true
    if (!platformPost.publishedAt) return false
    const intervalHours = getAdaptivePostIntervalHour(platformPost.publishedAt)
    return dayjs(latest.collectedAt).isBefore(dayjs().subtract(intervalHours, 'hour'))
  }

  async getDuePosts(accounts: SocialMediaAccount[], opts: { force?: boolean } = {}): Promise<DuePostItem[]> {
    const accountIds = accounts.map(a => a.id)
    if (accountIds.length === 0) return []
    const platformPostRows = await this.db.query.platformPosts.findMany({
      where: and(
        inArray(platformPosts.socialAccountId, accountIds),
        eq(platformPosts.status, 'published')
      ),
      orderBy: desc(platformPosts.publishedAt),
      limit: 500,
    })
    const items: DuePostItem[] = []
    for (const pp of platformPostRows) {
      if (!opts.force && !this.isPostDue(pp, await this.getLatestPostMetric(pp.id))) continue
      const account = accounts.find(a => a.id === pp.socialAccountId)
      if (!account) continue
      let postFull: PostWithAllData | null = null
      try {
        postFull = await postService.findByIdFull({ postId: pp.postId, userId: account.userId })
      } catch {
        continue
      }
      items.push({ postFull, platformPost: pp, account })
    }
    return items
  }

  async collectPostMetric(item: DuePostItem): Promise<{ success: boolean; error?: string }> {
    const now = dayjs().toDate()
    try {
      const insights = await this.autoPostService.getPostInsights({
        post: item.postFull,
        socialAccount: item.account,
        platform: item.account.platform,
      })
      const normalized = normalizePostInsights(insights as PostInsight[])
      const unavailable = Array.isArray(insights) && insights.some(i => String(i.label).toLowerCase().includes('unavailable'))
      const publishDetail = item.platformPost.publishDetail as Record<string, { publishedId?: string }> | undefined
      const externalPostId = publishDetail?.[item.platformPost.socialAccountId]?.publishedId || extractExternalPostId(item.postFull, item.account)
      await this.db.insert(postMetrics).values({
        id: crypto.randomUUID(),
        postId: item.platformPost.postId,
        platformPostId: item.platformPost.id,
        socialAccountId: item.platformPost.socialAccountId,
        platform: item.account.platform,
        externalPostId: externalPostId || null,
        metrics: normalized,
        rawPayload: insights,
        status: unavailable ? 'failed' : 'success',
        error: unavailable ? 'Insights unavailable for this platform' : null,
        collectedAt: now,
      })
      return { success: !unavailable, error: unavailable ? 'Insights unavailable for this platform' : undefined }
    } catch (error: unknown) {
      await this.db.insert(postMetrics).values({
        id: crypto.randomUUID(),
        postId: item.platformPost.postId,
        platformPostId: item.platformPost.id,
        socialAccountId: item.platformPost.socialAccountId,
        platform: item.account.platform,
        externalPostId: null,
        metrics: { total: 0 },
        rawPayload: null,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        collectedAt: now,
      })
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async collectAllDue(filters: PlatformStatsFilters = {}, opts: { force?: boolean } = {}): Promise<CollectAllResult> {
    const accounts = await this.getDueAccounts(filters, opts)
    const results: CollectStatsResult[] = []
    let accountsCollected = 0
    let accountsFailed = 0
    for (const account of accounts) {
      const result = await this.collectAccount(account, opts.force ? 'manual' : 'auto')
      results.push(result)
      if (result.success) {
        accountsCollected++
      } else {
        accountsFailed++
      }
    }
    const poolAccounts = accounts.length > 0 ? accounts : await socialMediaAccountService.getAccounts({ userId: filters.userId, businessId: filters.businessId, platform: filters.platform, isActive: true })
    const duePosts = await this.getDuePosts(poolAccounts, opts)
    let postsCollected = 0
    let postsFailed = 0
    for (const item of duePosts) {
      const result = await this.collectPostMetric(item)
      if (result.success) {
        postsCollected++
      } else {
        postsFailed++
      }
    }
    return {
      accountsDue: accounts.length,
      accountsCollected,
      accountsFailed,
      postsDue: duePosts.length,
      postsCollected,
      postsFailed,
      results,
    }
  }

  async pruneFailed(retentionDays?: number): Promise<{ accountRows: number; postRows: number }> {
    const days = retentionDays ?? Number(process.env.STATS_RETENTION_DAYS || 365)
    const cutoff = dayjs().subtract(days, 'day').toDate()
    const accountResult = await this.db.delete(accountMetrics).where(and(eq(accountMetrics.status, 'failed'), lt(accountMetrics.collectedAt, cutoff)))
    const postResult = await this.db.delete(postMetrics).where(and(eq(postMetrics.status, 'failed'), lt(postMetrics.collectedAt, cutoff)))
    return { accountRows: accountResult.changes ?? 0, postRows: postResult.changes ?? 0 }
  }
}

export const statsCollectorService = new StatsCollectorService()