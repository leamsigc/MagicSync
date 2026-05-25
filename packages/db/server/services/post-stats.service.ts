import type { PostStatsServiceType } from './interfaces'
import type { ServiceResponse } from './types'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { posts } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { postService } from './post.service'

export class PostStatsService implements PostStatsServiceType {
  private db = useDrizzle()

  async countPosts(filters: {
    userId: string
    businessId?: string
    startDate?: string
    endDate?: string
  }): Promise<number> {
    try {
      const whereConditions = [eq(posts.userId, filters.userId)]

      if (filters.businessId) {
        whereConditions.push(eq(posts.businessId, filters.businessId))
      }

      if (filters.startDate) {
        whereConditions.push(gte(posts.createdAt, new Date(filters.startDate)))
      }

      if (filters.endDate) {
        whereConditions.push(lte(posts.createdAt, new Date(filters.endDate)))
      }

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(and(...whereConditions))

      return result[0]?.count || 0
    } catch {
      return 0
    }
  }

  async getPostStats(businessId: string, userId: string, filters: { startDate?: string; endDate?: string; timezone?: string } = {}): Promise<ServiceResponse<any>> {
    try {
      const postsResult = await postService.findByBusinessId(businessId, userId, {
        pagination: { page: 1, limit: 1000 },
        filters
      })

      const allPosts = postsResult.data || []

      const stats = {
        total: allPosts.length,
        byStatus: {
          draft: allPosts.filter(p => p.status === 'pending').length,
          published: allPosts.filter(p => p.status === 'published').length,
          failed: allPosts.filter(p => p.status === 'failed').length
        },
        platformStats: {} as Record<string, { total: number; published: number; failed: number }>,
        recentActivity: {
          publishedToday: 0,
          scheduledNext7Days: 0,
          failedLast24Hours: 0
        },
        engagement: {
          totalPlatformPosts: 0,
          successfulPosts: 0,
          failedPosts: 0,
          successRate: 0
        }
      }

      const userTz = filters.timezone || 'UTC'

      const today = dayjs().tz(userTz).startOf('day').toDate()
      const next7Days = dayjs().tz(userTz).add(7, 'day').startOf('day').toDate()
      const last24Hours = dayjs.utc().subtract(24, 'hour').toDate()

      for (const post of allPosts) {
        if (post.publishedAt && post.publishedAt >= today) {
          stats.recentActivity.publishedToday++
        }

        if (post.status === 'pending' && post.scheduledAt && post.scheduledAt <= next7Days) {
          stats.recentActivity.scheduledNext7Days++
        }

        if (post.status === 'failed' && post.updatedAt >= last24Hours) {
          stats.recentActivity.failedLast24Hours++
        }

        if (post.platformPosts) {
          for (const platformPost of post.platformPosts) {
            stats.engagement.totalPlatformPosts++

            if (platformPost.status === 'published') {
              stats.engagement.successfulPosts++
            } else if (platformPost.status === 'failed') {
              stats.engagement.failedPosts++
            }

            const accountId = platformPost.socialAccountId
            if (!stats.platformStats[accountId]) {
              stats.platformStats[accountId] = { total: 0, published: 0, failed: 0 }
            }

            stats.platformStats[accountId].total++
            if (platformPost.status === 'published') {
              stats.platformStats[accountId].published++
            } else if (platformPost.status === 'failed') {
              stats.platformStats[accountId].failed++
            }
          }
        }
      }

      if (stats.engagement.totalPlatformPosts > 0) {
        stats.engagement.successRate = Math.round(
          (stats.engagement.successfulPosts / stats.engagement.totalPlatformPosts) * 100
        )
      }

      return { success: true, data: stats }
    } catch {
      return { success: false, error: 'Failed to calculate post statistics' }
    }
  }
}

export const postStatsService = new PostStatsService()
