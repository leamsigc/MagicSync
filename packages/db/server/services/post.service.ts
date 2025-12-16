import type { PlatformPost, Post, PostCreateBase, PostWithAllData, SocialMediaAccount, PublishDetail } from '#layers/BaseDB/db/schema'
import type {
  PaginatedResponse,
  QueryOptions,
  ServiceResponse
} from './types'
import { and, eq, gte, inArray, lte, sql, notExists, exists, or, not, between } from 'drizzle-orm'
import { assets, platformPosts, posts } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import {
  ValidationError
} from './types'
import { socialMediaAccountService } from './social-media-account.service'
import type { PostResponse } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import dayjs from '../utils/dayjs';



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

export class PostService {
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

      const [post] = await this.db.insert(posts).values({
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
        await this.db
          .update(assets)
          .set({ isPublic: true })
          .where(inArray(assets.id, data.mediaAssets))
      }

      if (data.targetPlatforms.length > 0) {
        const platformPostData = data.targetPlatforms.map(async (accountId: string) => {
          const account = await socialMediaAccountService.getAccountById(accountId)
          const platformName = account?.platform || accountId

          const platformSpecificSettings = data.platformSettings?.[platformName] || data.platformSettings?.[accountId] || null
          const platformSpecificContent = data.platformContent?.[platformName] || data.platformContent?.[accountId] || null

          const platformPostEntry = {
            id: crypto.randomUUID(),
            postId: id,
            socialAccountId: accountId,
            status: 'pending' as const,
            createdAt: now,
            platformPostId: account ? account.platform : null,
            platformSettings: platformSpecificSettings ? {
              ...platformSpecificSettings,
              platformContent: platformSpecificContent
            } : null
          }
          await this.db.insert(platformPosts).values(platformPostEntry).returning()
        })
        await Promise.all(platformPostData).catch((error) => {
          console.error('Error creating platform posts:', error)
        })
      }

      return { data: post }
    } catch (error) {
      if (error instanceof ValidationError) {
        return { error: error.message, code: error.code }
      }
      return { error: 'Failed to create post' + error }
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
        return { error: 'Post not found', code: 'NOT_FOUND' }
      }

      const result = post

      return { data: result }
    } catch (error) {
      return { error: 'Failed to fetch post' }
    }
  }

  async findByBusinessId(businessId: string, userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<PostWithAllData>> {
    try {
      const { pagination = { page: 1, limit: 10 }, filters = {} } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 10)

      let whereConditions = and(
        eq(posts.businessId, businessId),
        eq(posts.userId, userId)
      )

      // Apply status filter if provided
      if (filters.status) {
        whereConditions = and(whereConditions, eq(posts.status, filters.status))
      }

      // Apply date range filters
      if (filters.startDate) {
        whereConditions = and(whereConditions, gte(posts.createdAt, new Date(filters.startDate)))
      }
      if (filters.endDate) {
        whereConditions = and(whereConditions, lte(posts.createdAt, new Date(filters.endDate)))
      }
      const postList = await this.db.query.posts.findMany({
        where: whereConditions,
        with: {
          platformPosts: true,
          user: true,
        },
        limit: pagination.limit || 10,
        offset,
        orderBy: sql`${posts.createdAt} DESC`,
      })

      const postWithAssetsPromises = postList.map(async (post) => {
        const assetsIds: string[] = post.mediaAssets ? JSON.parse(post.mediaAssets) : []

        const assetResult = await this.db.query.assets.findMany({
          where: inArray(assets.id, assetsIds),
        });
        return {
          ...post,
          assets: assetResult, // Ensure assets is always an array
        }
      })

      const postWithAssets = await Promise.all(postWithAssetsPromises)
      // Get total count for pagination
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(whereConditions)

      const count = result[0]?.count || 0


      return {
        data: postWithAssets,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 10))
        }
      }
    } catch (error) {
      return { error: 'Failed to fetch posts' }
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

      return { data: scheduledPosts }
    } catch (error) {
      return { error: 'Failed to fetch scheduled posts' }
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
      // Check if post exists and belongs to user
      const existingResult = await this.findById(id, userId)
      if (!existingResult || existingResult.error) {
        return { error: 'Post not found' }
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

      const [updated] = await this.db
        .update(posts)
        .set(updateData)
        .where(and(eq(posts.id, id), eq(posts.userId, userId)))
        .returning()

      if (data.mediaAssets && data.mediaAssets.length > 0) {
        await this.db
          .update(assets)
          .set({ isPublic: true })
          .where(inArray(assets.id, data.mediaAssets))
      }
      // Update platform posts if target platforms changed
      if (data.targetPlatforms) {
        // Remove existing platform posts
        await this.db
          .delete(platformPosts)
          .where(eq(platformPosts.postId, id))
        // Create new platform posts
        const platformPostData = data.targetPlatforms.map(async (accountId) => {
          // Get the social media account by ID
          const account = await socialMediaAccountService.getAccountById(accountId)
          const platformName = account?.platform || accountId
          const platformSpecificSettings = data.platformSettings?.[platformName] || data.platformSettings?.[accountId] || null
          const platformSpecificContent = data.platformContent?.[platformName] || data.platformContent?.[accountId] || null


          const item = {
            id: crypto.randomUUID(),
            postId: id,
            socialAccountId: accountId,
            status: 'pending' as const,
            createdAt: updateData.updatedAt,
            platformPostId: account ? account.platform : null,
            platformSettings: platformSpecificSettings ? {
              ...platformSpecificSettings,
              platformContent: platformSpecificContent
            } : null
          }
          await this.db.insert(platformPosts).values(item).returning()
        })
        await Promise.all(platformPostData).catch((error) => {
          console.error('Error Updating platform posts:', error)
        })
      }
      return { data: updated }
    } catch (error) {
      console.error('Error Updating post:', error)
      return { error: 'Failed to update post' }
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
        return { error: 'Post not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update post status' }
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

      return {}

    } catch (error) {
      return { error: 'Failed to delete post' }
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
        return { error: 'Platform post not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update platform post' }
    }
  }

  async getPlatformPostsByPost(postId: string): Promise<ServiceResponse<PlatformPost[]>> {
    try {
      const platforms = await this.db
        .select()
        .from(platformPosts)
        .where(eq(platformPosts.postId, postId))

      return { data: platforms }
    } catch (error) {
      return { error: 'Failed to fetch platform posts' }
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

          error: 'Post does not have any failed publishing attempts to retry',
          code: 'INVALID_STATUS'
        }
      }

      // Reset post status if it was failed
      if (post.status === 'failed') {
        const updateResult = await this.updateStatus(id, userId, 'pending')
      }

      // Reset failed platform posts to pending
      if (post.platformPosts) {
        for (const platformPost of post.platformPosts) {
          if (platformPost.status === 'failed') {
            await this.updatePlatformPost(platformPost.id, {
              status: 'pending',
              errorMessage: undefined
            })
          }
        }
      }
      const item = await this.findById(id, userId, true);
      // Return updated item
      return item as ServiceResponse<PostWithAllData>
    } catch (error) {
      return { error: 'Failed to retry post' }
    }
  }

  async getPostStats(businessId: string, userId: string, filters: { startDate?: string; endDate?: string, timezone?: string } = {}): Promise<ServiceResponse<any>> {
    try {
      // Get all posts for the business
      const postsResult = await this.findByBusinessId(businessId, userId, {
        pagination: { page: 1, limit: 1000 }, // Get all posts for stats
        filters
      })

      const posts = postsResult.data || []

      // Calculate statistics
      const stats = {
        total: posts.length,
        byStatus: {
          draft: posts.filter(p => p.status === 'pending').length,
          published: posts.filter(p => p.status === 'published').length,
          failed: posts.filter(p => p.status === 'failed').length
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

      // Calculate date ranges for recent activity
      const today = dayjs().tz(userTz).startOf('day').toDate()
      const next7Days = dayjs().tz(userTz).add(7, 'day').startOf('day').toDate()
      const last24Hours = dayjs.utc().subtract(24, 'hour').toDate()

      // Process each post for detailed statistics
      for (const post of posts) {
        // Recent activity calculations
        if (post.publishedAt && post.publishedAt >= today) {
          stats.recentActivity.publishedToday++
        }

        if (post.status === 'pending' && post.scheduledAt && post.scheduledAt <= next7Days) {
          stats.recentActivity.scheduledNext7Days++
        }

        if (post.status === 'failed' && post.updatedAt >= last24Hours) {
          stats.recentActivity.failedLast24Hours++
        }

        // Platform statistics
        if (post.platformPosts) {
          for (const platformPost of post.platformPosts) {
            stats.engagement.totalPlatformPosts++

            if (platformPost.status === 'published') {
              stats.engagement.successfulPosts++
            } else if (platformPost.status === 'failed') {
              stats.engagement.failedPosts++
            }

            // Group by social account (platform)
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

      // Calculate success rate
      if (stats.engagement.totalPlatformPosts > 0) {
        stats.engagement.successRate = Math.round(
          (stats.engagement.successfulPosts / stats.engagement.totalPlatformPosts) * 100
        )
      }

      return { data: stats }
    } catch (error) {
      return { error: 'Failed to calculate post statistics' }
    }
  }

  async getPostsToProcessNow() {
    const now = dayjs.utc().toDate()
    const startOfToday = dayjs.utc().startOf('day').toDate();
    const endOfToday = dayjs.utc().endOf('day').toDate();

    const list = await this.db.query.posts.findMany({
      where: and(
        eq(posts.status, 'pending'),
        between(posts.scheduledAt, startOfToday, now)
      ),
      with: {
        platformPosts: true,
        user: true
      }
    })
    return list
  }

  async updatePostBaseOnResponse(post: PostWithAllData, response: PostResponse, socialPlatform: PlatformPost) {
    const socialPlatformId = socialPlatform.socialAccountId;
    // Check on the old details and update
    const oldDetails = JSON.parse(socialPlatform.publishDetail as unknown as string || '{}');


    const platformSpecificDetails = {
      publishedId: response.postId,
      publishedUrl: response.releaseURL
    }
    const publishDetails: PublishDetail = new Map(Object.entries(oldDetails));
    publishDetails.set(socialPlatformId, platformSpecificDetails);
    const detailsString = JSON.stringify(Object.fromEntries(publishDetails));


    await this.updateStatus(post.id, post.user.id, response.status)
    await this.updatePlatformPost(socialPlatform.id, { publishDetail: detailsString, status: response.status })
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
