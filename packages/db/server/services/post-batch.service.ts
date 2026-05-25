import type { Post, PostWithAllData, PlatformPost, PublishDetail, Asset } from '#layers/BaseDB/db/schema'
import type { PostBatchServiceType } from './interfaces'
import type { ServiceResponse, PostResponse } from './types'
import { and, eq, isNull, lte, or, inArray } from 'drizzle-orm'
import { posts, platformPosts, assets } from '#layers/BaseDB/db/schema'
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
      .flatMap(post => {
        try {
          return post.mediaAssets ? JSON.parse(post.mediaAssets as unknown as string) : []
        } catch {
          return []
        }
      })
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
          const assetIds = JSON.parse(post.mediaAssets as unknown as string) as string[]
          if (assetIds && assetIds.length > 0) {
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
    const oldDetails = JSON.parse(socialPlatform.publishDetail as unknown as string || '{}')

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
}

export const postBatchService = new PostBatchService()
