import type { PlatformPost, Post, PostCreateBase, PostWithAllData, Asset } from '#layers/BaseDB/db/schema'
import type {
  PaginatedResponse,
  QueryOptions,
  ServiceResponse,
} from './types'
import type { PostServiceType } from './interfaces'
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { assets, platformPosts, posts, socialMediaAccounts } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { ValidationError } from './types'


export interface UpdatePostData extends Omit<PostCreateBase, 'businessId' | 'userId'> { }

export interface CreatePlatformPostData {
  postId: string
  socialAccountId: string
  platformPostId?: string
  status?: 'pending' | 'published' | 'failed'
  errorMessage?: string
  publishDetail?: String
  platformSettings?: string
}

export class PostService implements PostServiceType {
  private db = useDrizzle()

  async create(userId: string, data: PostCreateBase): Promise<ServiceResponse<Post>> {
    try {
      this.validateCreateData(data)

      const id = crypto.randomUUID()
      const now = dayjs.utc().toDate()

      let status: 'pending' = 'pending'
      if (data.scheduledAt && data.scheduledAt > now) {
        status = 'pending'
      }

      return await this.db.transaction(async (tx) => {
        const [post] = await tx.insert(posts).values({
          id,
          userId,
          businessId: data.businessId,
          content: data.content,
          mediaAssets: data.mediaAssets ? JSON.stringify(data.mediaAssets) : null,
          scheduledAt: dayjs(data.scheduledAt).utc().toDate(),
          targetPlatforms: JSON.stringify(data.targetPlatforms),
          status,
          platformContent: data.platformContent || null,
          platformSettings: data.platformSettings || null,
          postFormat: data.postFormat || 'post',
          createdAt: now,
          updatedAt: now
        }).returning()

        if (data.mediaAssets && data.mediaAssets.length > 0) {
          await tx
            .update(assets)
            .set({ isPublic: true })
            .where(inArray(assets.id, data.mediaAssets))
        }

        if (data.targetPlatforms.length > 0) {
          // Batch-fetch all accounts in a single query instead of N individual calls
          const accountRows = await tx.query.socialMediaAccounts.findMany({
            where: inArray(socialMediaAccounts.id, data.targetPlatforms)
          })
          const accountMap = new Map(accountRows.map(a => [a.id, a.platform]))

          const platformPostEntries = data.targetPlatforms.map((accountId: string) => {
            const platformName = accountMap.get(accountId) ?? accountId
            const platformSpecificSettings = data.platformSettings?.[platformName] || data.platformSettings?.[accountId] || null
            const platformSpecificContent = data.platformContent?.[platformName] || data.platformContent?.[accountId] || null

            return {
              id: crypto.randomUUID(),
              postId: id,
              socialAccountId: accountId,
              status: 'pending' as const,
              createdAt: now,
              platformPostId: accountMap.get(accountId) ?? null,
              platformSettings: platformSpecificSettings ? {
                ...platformSpecificSettings,
                platformContent: platformSpecificContent
              } : null
            }
          })

          await tx.insert(platformPosts).values(platformPostEntries)
        }

        return { success: true, data: post }
      })
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message, code: error.code }
      }
      return { success: false, error: 'Failed to create post' + error }
    }
  }

  async findById(id: string, userId: string, includePlatforms: boolean = false, includeUser: boolean = false): Promise<ServiceResponse<PostWithAllData | Post>> {
    try {
      const include: Record<string, boolean> = {}
      if (includePlatforms) {
        include.platformPosts = true
      }
      if (includeUser) {
        include.user = true
      }

      const post = await this.db.query.posts.findFirst({
        where: and(eq(posts.id, id), eq(posts.userId, userId)),
        with: include
      })
      if (!post) {
        return { success: false, error: 'Post not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: result }
    } catch {
      return { success: false, error: 'Failed to fetch post' }
    }
  }

  async findByBusinessId(businessId: string, userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<PostWithAllData>> {
    try {
      const { pagination = { page: 1, limit: 10 }, filters = {} } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 10)

      const whereConditions = [
        eq(posts.businessId, businessId),
        eq(posts.userId, userId)
      ]

      // Apply status filter if provided
      if (filters.status) {
        whereConditions.push(eq(posts.status, filters.status))
      }

      // Apply post format filter
      if (filters.postFormat) {
        whereConditions.push(eq(posts.postFormat, filters.postFormat))
      }

      // Determine which date field to filter by
      const dateField = filters.dateType === 'createdAt' ? posts.createdAt
        : filters.dateType === 'publishedAt' ? posts.publishedAt
          : posts.scheduledAt

      // Apply date range filters
      if (filters.startDate) {
        whereConditions.push(gte(dateField, new Date(filters.startDate)))
      }
      if (filters.endDate) {
        whereConditions.push(lte(dateField, new Date(filters.endDate)))
      }

      // Apply platform filter (filter by target platforms)
      if (filters.platforms && filters.platforms.length > 0) {
        whereConditions.push(sql`
          ${posts.targetPlatforms} LIKE ${'%' + filters.platforms[0] + '%'}
        `)
      }
      const postList = await this.db.query.posts.findMany({
        where: and(...whereConditions),
        with: {
          platformPosts: true,
          user: true,
        },
        limit: pagination.limit || 10,
        offset,
        orderBy: sql`${posts.createdAt} DESC`,
      })

      // Batch fetch all asset IDs from all posts to avoid N+1
      const allAssetIds = postList
        .flatMap(post => {
          try {
            return post.mediaAssets ? JSON.parse(post.mediaAssets) : []
          } catch {
            return []
          }
        })
        .filter((id): id is string => typeof id === 'string')

      const assetsMap = new Map<string, Asset>()
      if (allAssetIds.length > 0) {
        const allAssets = await this.db.query.assets.findMany({
          where: inArray(assets.id, allAssetIds),
        })
        allAssets.forEach(asset => assetsMap.set(asset.id, asset))
      }

      // Map assets back to posts
      const postWithAssets = postList.map(post => {
        const assetIds: string[] = post.mediaAssets ? JSON.parse(post.mediaAssets) : []
        return {
          ...post,
          assets: assetIds.map(id => assetsMap.get(id)).filter((a): a is Asset => !!a),
        }
      })
      // Get total count for pagination
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(and(...whereConditions))

      const count = result[0]?.count || 0


      return {
        success: true,
        data: postWithAssets as PostWithAllData[],
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 10))
        }
      }
    } catch (error) {
      return { success: false, error: 'Failed to fetch posts' }
    }
  }

  async findScheduledPosts(beforeDate?: Date): Promise<ServiceResponse<Post[]>> {
    try {
      const cutoffDate = beforeDate || dayjs.utc().toDate()

      const scheduledPosts = await this.db
        .select()
        .from(posts)
        .where(and(
          eq(posts.status, 'pending'),
          lte(posts.scheduledAt, cutoffDate)
        ))
        .orderBy(posts.scheduledAt)

      return { success: true, data: scheduledPosts }
    } catch {
      return { success: false, error: 'Failed to fetch scheduled posts' }
    }
  }

  async findByIdFull({ postId }: { postId: string }): Promise<PostWithAllData> {
    const post = await this.db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: {
        platformPosts: true,
        user: true,
      }
    }) as PostWithAllData;
    if (!post) {
      throw new Error('Post not found')
    }
    const assetsIds = post.mediaAssets ? JSON.parse(post.mediaAssets) : []
    const postAssets = await this.db.query.assets.findMany({
      where: inArray(assets.id, assetsIds),
    })
    post.assets = postAssets;
    return post;
  }

  async update(id: string, userId: string, data: UpdatePostData): Promise<ServiceResponse<Post>> {
    try {
      return await this.db.transaction(async (tx) => {
        // Check if post exists and belongs to user INSIDE transaction to prevent race condition
        const existingPost = await tx.query.posts.findFirst({
          where: and(eq(posts.id, id), eq(posts.userId, userId))
        })
        if (!existingPost) {
          return { success: false, error: 'Post not found' }
        }

        const updateData: any = {
          ...data,
          updatedAt: dayjs.utc().toDate()
        }

        // Handle JSON fields
        if (data.mediaAssets !== undefined && data.mediaAssets.length > 0) {
          updateData.mediaAssets = data.mediaAssets ? JSON.stringify(data.mediaAssets) : null
        }
        if (data.targetPlatforms !== undefined && data.targetPlatforms.length > 0) {
          updateData.targetPlatforms = JSON.stringify(data.targetPlatforms)
        }

        const [updated] = await tx
          .update(posts)
          .set(updateData)
          .where(and(eq(posts.id, id), eq(posts.userId, userId)))
          .returning()

        if (data.mediaAssets && data.mediaAssets.length > 0) {
          await tx
            .update(assets)
            .set({ isPublic: true })
            .where(inArray(assets.id, data.mediaAssets))
        }
        // Update platform posts if target platforms changed
        if (data.targetPlatforms) {
          // Remove existing platform posts
          await tx
            .delete(platformPosts)
            .where(eq(platformPosts.postId, id))

          // Batch-fetch all accounts in a single query instead of N individual calls
          const accountRows = await tx.query.socialMediaAccounts.findMany({
            where: inArray(socialMediaAccounts.id, data.targetPlatforms)
          })
          const accountMap = new Map(accountRows.map(a => [a.id, a.platform]))

          // Create new platform posts
          const platformPostEntries = data.targetPlatforms.map((accountId: string) => {
            const platformName = accountMap.get(accountId) ?? accountId
            const platformSpecificSettings = data.platformSettings?.[platformName] || data.platformSettings?.[accountId] || null
            const platformSpecificContent = data.platformContent?.[platformName] || data.platformContent?.[accountId] || null

            return {
              id: crypto.randomUUID(),
              postId: id,
              socialAccountId: accountId,
              status: 'pending' as const,
              createdAt: updateData.updatedAt,
              platformPostId: accountMap.get(accountId) ?? null,
              platformSettings: platformSpecificSettings ? {
                ...platformSpecificSettings,
                platformContent: platformSpecificContent
              } : null
            }
          })

          await tx.insert(platformPosts).values(platformPostEntries)
        }
        return { success: true, data: updated }
      })
    } catch (error) {
      console.error('Error Updating post:', error)
      return { success: false, error: 'Failed to update post' }
    }
  }

  async updateStatus(id: string, userId: string, status: 'pending' | 'published' | 'failed'): Promise<ServiceResponse<Post>> {
    try {
      const updateData: any = {
        status,
        updatedAt: dayjs.utc().toDate()
      }

      if (status === 'published') {
        updateData.publishedAt = dayjs.utc().toDate()
        updateData.scheduledAt = dayjs.utc().toDate()
      }

      const [updated] = await this.db
        .update(posts)
        .set(updateData)
        .where(and(eq(posts.id, id), eq(posts.userId, userId)))
        .returning()

      if (!updated) {
        return { success: false, error: 'Post not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update post status' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<void>> {
    try {
      // Check if post exists and belongs to user
      const existingResult = await this.findById(id, userId)

      // Delete platform posts first (cascade should handle this, but being explicit)
      await this.db
        .delete(platformPosts)
        .where(eq(platformPosts.postId, id))

      // Delete the post
      await this.db
        .delete(posts)
        .where(and(eq(posts.id, id), eq(posts.userId, userId)))

      return { success: true }

    } catch (error) {
      return { success: false, error: 'Failed to delete post' }
    }
  }

  // Platform post management
  async updatePlatformPost(id: string, data: Partial<CreatePlatformPostData>): Promise<ServiceResponse<PlatformPost>> {
    try {
      const [updated] = await this.db
        .update(platformPosts)
        .set({
          ...data,
          publishedAt: data.status === 'published' ? dayjs.utc().toDate() : undefined
        })
        .where(eq(platformPosts.id, id))
        .returning()

      if (!updated) {
        return { success: false, error: 'Platform post not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update platform post' }
    }
  }

  async getPlatformPostsByPost(postId: string): Promise<ServiceResponse<PlatformPost[]>> {
    try {
      const platforms = await this.db
        .select()
        .from(platformPosts)
        .where(eq(platformPosts.postId, postId))

      return { success: true, data: platforms }
    } catch {
      return { success: false, error: 'Failed to fetch platform posts' }
    }
  }

  async retryFailedPost(id: string, userId: string): Promise<ServiceResponse<PostWithAllData>> {
    try {
      // Get the post with platform posts
      const postResult = await this.findById(id, userId, true)


      const post = postResult.data as PostWithAllData

      // Check if post can be retried
      if (post.status !== 'failed' && !post.platformPosts.some(p => p.status === 'failed')) {
        return {
          success: false,
          error: 'Post does not have any failed publishing attempts to retry',
          code: 'INVALID_STATUS'
        }
      }

      // Reset post status if it was failed
      if (post.status === 'failed') {
        await this.updateStatus(id, userId, 'pending')
      }

      // Batch reset all failed platform posts to pending in a single query
      const failedPlatformPostIds = post.platformPosts
        .filter(p => p.status === 'failed')
        .map(p => p.id)

      if (failedPlatformPostIds.length > 0) {
        await this.db
          .update(platformPosts)
          .set({
            status: 'pending',
            errorMessage: null
          })
          .where(inArray(platformPosts.id, failedPlatformPostIds))
      }

      // Return updated item
      return await this.findById(id, userId, true) as ServiceResponse<PostWithAllData>
    } catch (error) {
      return { success: false, error: 'Failed to retry post' }
    }
  }

  private validateCreateData(data: PostCreateBase): void {

    if (!data.businessId || data.businessId.trim().length === 0) {
      throw new ValidationError('Business ID is required', 'businessId')
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new ValidationError('Post content is required', 'content')
    }

    if (data.content.length > 2000) {
      throw new ValidationError('Post content must be less than 2000 characters', 'content')
    }

    if (!data.targetPlatforms || data.targetPlatforms.length === 0) {
      throw new ValidationError('At least one target platform is required', 'targetPlatforms')
    }

    if ((data.status === 'pending') && (data.scheduledAt && data.scheduledAt <= dayjs().toDate())) {
      throw new ValidationError('Scheduled time must be in the future', 'scheduledAt')
    }
  }


}

export const postService = new PostService()

export { postStatsService } from './post-stats.service'
export { postBatchService } from './post-batch.service'
export { PostStatsService } from './post-stats.service'
export { PostBatchService } from './post-batch.service'