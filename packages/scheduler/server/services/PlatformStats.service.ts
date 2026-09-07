/**
 * Platform Stats Service
 *
 * Shared types + plugin-based account stats fetch.
 * Reads are served by Analytics.service (accountMetrics/postMetrics tables),
 * collection is handled by StatsCollector.service.
 *
 * @version 0.1.0
 */

import type { PlatformStats } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import type { SocialMediaAccount } from '#layers/BaseDB/db/schema'
import { AutoPostService } from './AutoPost.service'

export interface PlatformStatsFilters {
  businessId?: string
  userId?: string
  platform?: import('#layers/BaseDB/server/services/social-media-account.service').SocialMediaPlatform
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
  private autoPostService = new AutoPostService()

  async fetchAccountStats(account: SocialMediaAccount): Promise<{ stats: PlatformStats | null; error?: string }> {
    try {
      const stats = await this.autoPostService.getStatisticForAccount({
        platform: account.platform,
        account,
      })
      return { stats }
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { data?: { error?: { message?: string } } } }
      const errorMessage = err.message || err.response?.data?.error?.message || String(error)
      console.error(`[PlatformStats] Failed to fetch stats for ${account.platform}/${account.accountId}:`, errorMessage)
      return { stats: null, error: errorMessage }
    }
  }
}

export const platformStatsService = new PlatformStatsService()
