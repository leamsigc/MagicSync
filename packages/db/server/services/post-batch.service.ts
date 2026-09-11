import type { Post, PostWithAllData, PlatformPost, PublishDetail, Asset } from '#layers/BaseDB/db/schema'
import type { PostBatchServiceType } from './interfaces'
import type { ServiceResponse, PostResponse } from './types'
import { and, eq, isNull, lte, or, inArray, sql, isNotNull } from 'drizzle-orm'
import { posts, platformPosts, assets } from '#layers/BaseDB/db/schema'
import { parseJsonArray, parseJsonObject, toJsonString } from '#layers/BaseShared/utils/json'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { postService } from './post.service'

export class PostBatchService implements PostBatchServiceType {
  private db = useDrizzle()

  async getPostsToProcessNow(): Promise<PostWithAllData[]> {
    const now = dayjs.utc().toDate()

    const list = await this.db.query.posts.findMany({
      where: and(
        eq(posts.status, 'pending'),
        lte(posts.scheduledAt, now),
        or(
          isNull(posts.nextRetryAt),
          lte(posts.nextRetryAt, now)
        )
      ),
      with: {
        platformPosts: true,
        user: true
      },
      orderBy: (posts, { asc }) => [asc(posts.scheduledAt)],
      limit: 100
    })

    const allAssetIds = list
      .flatMap(post => parseJsonArray<string>(toJsonString(post.mediaAssets, '[]')))
      .filter((id): id is string => typeof id === 'string')

    const assetsMap = new Map<string, Asset>()
    if (allAssetIds.length > 0) {
      const allAssets = await this.db.query.assets.findMany({
        where: inArray(assets.id, allAssetIds)
      })
      allAssets.forEach(asset => assetsMap.set(asset.id, asset))
    }

    const postsWithAssets = list.map(post => {
      let assetsList: Asset[] = []
      if (post.mediaAssets) {
        try {
          const assetIds = parseJsonArray<string>(toJsonString(post.mediaAssets, '[]'))
          if (assetIds.length > 0) {
            assetsList = assetIds.map(id => assetsMap.get(id)).filter((a): a is Asset => !!a)
          }
        } catch {
        }
      }
      return {
        ...post,
        assets: assetsList
      } as PostWithAllData
    })

    return postsWithAssets
  }

  async scheduleRetry(postId: string, currentRetryCount: number, error: string): Promise<ServiceResponse<Post>> {
    const MAX_RETRIES = 5
    const newRetryCount = currentRetryCount + 1

    if (newRetryCount >= MAX_RETRIES) {
      const [updated] = await this.db
        .update(posts)
        .set({
          status: 'failed',
          lastError: error,
          nextRetryAt: null,
          updatedAt: dayjs.utc().toDate()
        })
        .where(eq(posts.id, postId))
        .returning()
      return { success: true, data: updated, code: 'RETRY_EXHAUSTED' }
    }

    const backoffMs = 5 * 60 * 1000 * Math.pow(2, currentRetryCount)
    const nextRetryAt = dayjs.utc().add(backoffMs, 'ms').toDate()

    const [updated] = await this.db
      .update(posts)
      .set({
        retryCount: newRetryCount,
        nextRetryAt,
        lastError: error,
        updatedAt: dayjs.utc().toDate()
      })
      .where(eq(posts.id, postId))
      .returning()

    return { success: true, data: updated }
  }

  async updatePostBaseOnResponse(post: PostWithAllData, response: PostResponse, socialPlatform: PlatformPost) {
    const socialPlatformId = socialPlatform.socialAccountId
    const oldDetails = parseJsonObject(toJsonString(socialPlatform.publishDetail))

    const platformSpecificDetails = {
      publishedId: response.postId,
      publishedUrl: response.releaseURL
    }
    const publishDetails: PublishDetail = new Map(Object.entries(oldDetails))
    publishDetails.set(socialPlatformId, platformSpecificDetails)
    const detailsString = JSON.stringify(Object.fromEntries(publishDetails))

    await postService.updateStatus(post.id, post.user.id, response.status)
    await postService.updatePlatformPost(socialPlatform.id, { publishDetail: detailsString, status: response.status })
  }

  async getDueReposts(now: Date): Promise<ServiceResponse<Post[]>> {
    try {
      const rows = await this.db.query.posts.findMany({
        where: and(
          isNotNull(posts.autoRepost),
          eq(posts.status, 'published')
        )
      })
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to fetch due reposts' }
    }
  }

  async createRepost(data: {
    originalPostId: string
    userId: string
    businessId: string
    content: string
    mediaAssets: string[]
    targetPlatforms: string[]
    platformContent?: Record<string, unknown>
    platformSettings?: Record<string, unknown>
    postFormat: string
    scheduledAt: Date
    repostParentId: string
  }): Promise<ServiceResponse<Post>> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()

      const [created] = await this.db.insert(posts).values({
        id,
        userId: data.userId,
        businessId: data.businessId,
        content: data.content,
        mediaAssets: JSON.stringify(data.mediaAssets),
        targetPlatforms: JSON.stringify(data.targetPlatforms),
        platformContent: data.platformContent ? JSON.stringify(data.platformContent) : null,
        platformSettings: data.platformSettings ? JSON.stringify(data.platformSettings) : null,
        postFormat: data.postFormat as 'post' | 'reel' | 'story' | 'short',
        scheduledAt: data.scheduledAt,
        status: 'pending',
        repostParentId: data.repostParentId,
        createdAt: now,
        updatedAt: now
      }).returning()

      if (!created) {
        return { success: false, error: 'Failed to create repost' }
      }
      return { success: true, data: created }
    } catch {
      return { success: false, error: 'Failed to create repost' }
    }
  }

  async updateAutoRepostConfig(postId: string, config: Record<string, unknown>): Promise<ServiceResponse<Post>> {
    try {
      const [updated] = await this.db.update(posts)
        .set({
          autoRepost: JSON.stringify(config),
          updatedAt: new Date()
        })
        .where(eq(posts.id, postId))
        .returning()
      if (!updated) {
        return { success: false, error: 'Post not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update auto-repost config' }
    }
  }

  async incrementRepostCount(postId: string): Promise<ServiceResponse<Post>> {
    try {
      const [updated] = await this.db.update(posts)
        .set({
          repostCount: sql`${posts.repostCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(posts.id, postId))
        .returning()
      if (!updated) {
        return { success: false, error: 'Post not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to increment repost count' }
    }
  }
}

export const postBatchService = new PostBatchService()
