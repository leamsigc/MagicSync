import type { PlatformPost, Post, PostCreateBase, PostWithAllData, PostWithBusinessData, Asset } from '#layers/BaseDB/db/schema'
import type {
  PaginatedResponse,
  QueryOptions,
  ServiceResponse,
} from './types'
import type { PostServiceType } from './interfaces'
import { and, eq, exists, gte, inArray, lt, lte, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { assets, businessProfiles, member, organization, platformPosts, posts, socialMediaAccounts } from '#layers/BaseDB/db/schema'
import { parseJsonObject, toJsonString } from '#layers/BaseShared/utils/json'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { ValidationError } from './types'


export interface UpdatePostData extends Partial<Omit<PostCreateBase, 'businessId' | 'userId'>> { }

/** Platform names as the accounts table knows them. */
type AccountPlatform = typeof socialMediaAccounts.$inferSelect['platform']

/**
 * Everything the calendar range read can narrow by. The client already sends
 * all four (see `usePostFilters` + `PostCalendarFilters`); they arrive here
 * validated by the route, never trusted raw.
 */
export interface CalendarRangeOptions {
  start: Date
  end: Date
  businessIds?: string[]
  status?: 'pending' | 'published' | 'failed'
  postFormat?: 'post' | 'reel' | 'story' | 'short'
  dateType?: 'scheduledAt' | 'createdAt' | 'publishedAt'
  /** Platform names (`facebook`, `twitter`, …), not account ids. */
  platforms?: string[]
  /** Relative-window bounds: intersected with `start`/`end` before reading. */
  windowStart?: Date
  windowEnd?: Date
}

/** Later of the range start and the window floor. */
function maxDate(base: Date, bound?: Date): Date {
  return bound && bound.getTime() > base.getTime() ? bound : base
}

/** Earlier of the range end and the window ceiling. */
function minDate(base: Date, bound?: Date): Date {
  return bound && bound.getTime() < base.getTime() ? bound : base
}

/**
 * Asset ids off a post's `mediaAssets` JSON string.
 *
 * A malformed or non-array value is treated as "no assets" rather than an
 * error: one bad row must not fail a whole calendar range.
 */
function parseAssetIds(mediaAssets: string | null): string[] {
  if (!mediaAssets) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(mediaAssets)

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

export interface CreatePlatformPostData {
  postId: string
  socialAccountId: string
  platformPostId?: string
  status?: 'pending' | 'published' | 'failed'
  errorMessage?: string
  publishDetail?: String
  platformSettings?: string
}

/**
 * Reconcile a post's `platform_posts` rows with the account list being saved.
 *
 * Rows that already published are preserved: they are proof the platform
 * accepted the post, and recreating them as `pending` made the next trigger
 * re-publish to every platform that had already succeeded (duplicate posts).
 * Removed accounts and every non-published row are dropped; only accounts
 * without a surviving row are inserted as `pending`, which is what makes an
 * edit-then-post retry the failed platform alone.
 */
async function syncPlatformPostsAfterUpdate(
  tx: any,
  postId: string,
  data: UpdatePostData,
  updatedAt: Date,
): Promise<void> {
  const targetAccountIds = data.targetPlatforms ?? []
  const existingRows = await tx.query.platformPosts.findMany({
    where: eq(platformPosts.postId, postId),
  })

  if (targetAccountIds.length === 0) {
    if (existingRows.length > 0) {
      await tx.delete(platformPosts).where(eq(platformPosts.postId, postId))
    }
    return
  }

  const keptAccountIds = new Set<string>(
    existingRows
      .filter((row: PlatformPost) => row.status === 'published' && targetAccountIds.includes(row.socialAccountId))
      .map((row: PlatformPost) => row.socialAccountId),
  )
  const dropIds = existingRows
    .filter((row: PlatformPost) => !keptAccountIds.has(row.socialAccountId))
    .map((row: PlatformPost) => row.id)

  if (dropIds.length > 0) {
    await tx.delete(platformPosts).where(inArray(platformPosts.id, dropIds))
  }

  const accountRows = await tx.query.socialMediaAccounts.findMany({
    where: inArray(socialMediaAccounts.id, targetAccountIds),
  })
  const accountMap = new Map<string, AccountPlatform>(accountRows.map((account: any) => [account.id, account.platform]))

  const entries = targetAccountIds
    .filter((accountId: string) => !keptAccountIds.has(accountId))
    .map((accountId: string) => {
      const platformName = accountMap.get(accountId) ?? accountId
      const platformSpecificSettings = data.platformSettings?.[platformName] || data.platformSettings?.[accountId] || null
      const platformSpecificContent = data.platformContent?.[platformName] || data.platformContent?.[accountId] || null

      return {
        id: crypto.randomUUID(),
        postId,
        socialAccountId: accountId,
        status: 'pending' as const,
        createdAt: updatedAt,
        platformPostId: accountMap.get(accountId) ?? null,
        platformSettings: platformSpecificSettings ? {
          ...platformSpecificSettings,
          platformContent: platformSpecificContent
        } : null
      }
    })

  if (entries.length > 0) {
    await tx.insert(platformPosts).values(entries)
  }
}

/**
 * Post-level status from its platform rows. Failure wins so a partial failure
 * is never reported as a success; any success marks the post published (which
 * also stops the scheduler from re-processing it); otherwise pending.
 */
function aggregatePlatformStatus(
  statuses: Array<'pending' | 'published' | 'failed'>,
): 'pending' | 'published' | 'failed' {
  if (statuses.some(status => status === 'failed')) return 'failed'
  if (statuses.some(status => status === 'published')) return 'published'
  return 'pending'
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
      return { success: true, data: post }
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

  /**
   * Every post the caller may see inside a half-open `[start, end)` range,
   * across all of the caller's businesses.
   *
   * Drives the calendar, which needs one cross-business range read rather than
   * a per-business page. Ownership is folded into the predicate: the requested
   * `businessIds` are intersected with `getAccessibleBusinessIds(userId)`
   * before they reach the query, so an id the caller cannot read simply drops
   * out of the scope instead of leaking another user's posts.
   *
   * Posts with a null `scheduledAt` never enter the range: the calendar cannot
   * place them. They stay reachable through `findByBusinessId`, which is what
   * `/app/posts` renders.
   *
   * A `status` matches the post row *or* any of its platform rows: a post that
   * failed on one platform reads as failed even when the row itself says
   * otherwise. `platforms` matches a post with at least one publish row hung
   * off an account on a named platform.
   */
  async findByBusinessIdsForRange(
    userId: string,
    options: CalendarRangeOptions
  ): Promise<ServiceResponse<PostWithBusinessData[]>> {
    try {
      const scopedBusinessIds = await this.resolveCalendarScope(userId, options.businessIds)
      if (scopedBusinessIds.length === 0) {
        return { success: true, data: [] }
      }

      // A relative window narrows the visible range from either side. An
      // inverted window matches nothing by construction, not by accident.
      const start = maxDate(options.start, options.windowStart)
      const end = minDate(options.end, options.windowEnd)
      if (start.getTime() >= end.getTime()) {
        return { success: true, data: [] }
      }

      const rows = await this.db.query.posts.findMany({
        where: and(
          inArray(posts.businessId, scopedBusinessIds),
          ...this.calendarRangeConditions({ ...options, start, end })
        ),
        with: {
          platformPosts: true,
          user: true,
          businessProfile: true,
        },
        orderBy: sql`${posts.scheduledAt} ASC`,
      })

      const assetsById = await this.findAssetsByIds(rows)

      const data = rows.map(row => ({
        ...row,
        assets: parseAssetIds(row.mediaAssets)
          .map(id => assetsById.get(id))
          .filter((asset): asset is Asset => !!asset),
        business: { id: row.businessProfile.id, name: row.businessProfile.name },
      })) as PostWithBusinessData[]

      return { success: true, data }
    } catch {
      return { success: false, error: 'Failed to fetch posts for range' }
    }
  }

  /**
   * The range bounds plus one predicate per active filter. A missing filter
   * contributes nothing, so the unfiltered read is exactly the old query.
   */
  private calendarRangeConditions(options: CalendarRangeOptions): SQL[] {
    const dateField = options.dateType === 'createdAt' ? posts.createdAt
      : options.dateType === 'publishedAt' ? posts.publishedAt
        : posts.scheduledAt

    const conditions: SQL[] = [
      gte(dateField, options.start),
      lt(dateField, options.end),
    ]

    if (options.status) {
      conditions.push(this.calendarStatusCondition(options.status))
    }
    if (options.postFormat) {
      conditions.push(eq(posts.postFormat, options.postFormat))
    }

    const platformCondition = this.calendarPlatformCondition(options.platforms)
    if (platformCondition) {
      conditions.push(platformCondition)
    }

    return conditions
  }

  /**
   * A status matches the post row or any of its platform rows. Publish rows
   * only ever carry pending/published/failed, and the filter UI offers exactly
   * those three, so the subquery needs no further narrowing.
   */
  private calendarStatusCondition(status: 'pending' | 'published' | 'failed'): SQL {
    return or(
      eq(posts.status, status),
      exists(
        this.db.select({ one: sql`1` }).from(platformPosts).where(
          and(eq(platformPosts.postId, posts.id), eq(platformPosts.status, status))
        )
      )
    )
  }

  /**
   * A post targets a platform when one of its publish rows hangs off an
   * account on that platform. Unknown names match nothing rather than
   * everything — the same empty result the old LIKE filter gave a typo.
   */
  private calendarPlatformCondition(platforms?: string[]): SQL | undefined {
    if (!platforms || platforms.length === 0) {
      return undefined
    }

    return exists(
      this.db.select({ one: sql`1` }).from(platformPosts)
        .innerJoin(socialMediaAccounts, eq(platformPosts.socialAccountId, socialMediaAccounts.id))
        .where(and(
          eq(platformPosts.postId, posts.id),
          inArray(socialMediaAccounts.platform, platforms as AccountPlatform[])
        ))
    )
  }

  /**
   * Businesses the caller asked for, narrowed to the ones they may read.
   * An empty request means "every business I can access".
   */
  private async resolveCalendarScope(userId: string, requestedIds?: string[]): Promise<string[]> {
    const accessibleBusinessIds = await this.getAccessibleBusinessIds(userId)
    if (!requestedIds || requestedIds.length === 0) {
      return accessibleBusinessIds
    }

    const requested = new Set(requestedIds)

    return accessibleBusinessIds.filter(id => requested.has(id))
  }

  /** One batched asset lookup for a whole range, never one query per post. */
  private async findAssetsByIds(rows: { mediaAssets: string | null }[]): Promise<Map<string, Asset>> {
    const allAssetIds = rows.flatMap(row => parseAssetIds(row.mediaAssets))
    if (allAssetIds.length === 0) {
      return new Map()
    }

    const allAssets = await this.db.query.assets.findMany({
      where: inArray(assets.id, allAssetIds),
    })

    return new Map(allAssets.map(asset => [asset.id, asset]))
  }

  async findScheduledPosts(userId: string, beforeDate?: Date): Promise<ServiceResponse<Post[]>> {
    try {
      const cutoffDate = beforeDate || dayjs.utc().toDate()

      const accessibleBusinessIds = await this.getAccessibleBusinessIds(userId)
      const businessCondition = accessibleBusinessIds.length > 0
        ? inArray(posts.businessId, accessibleBusinessIds)
        : undefined

      // Owner OR business-org-member access (team members see their business's posts).
      const scheduledPosts = await this.db
        .select()
        .from(posts)
        .where(and(
          eq(posts.status, 'pending'),
          lte(posts.scheduledAt, cutoffDate),
          or(
            eq(posts.userId, userId),
            businessCondition
          )
        ))
        .orderBy(posts.scheduledAt)

      return { success: true, data: scheduledPosts }
    } catch {
      return { success: false, error: 'Failed to fetch scheduled posts' }
    }
  }

  async findByIdFull({ postId, userId }: { postId: string; userId: string }): Promise<PostWithAllData> {
    const withRelations = {
      platformPosts: true,
      user: true,
    } as const

    // Owner path: the post belongs to the requesting user.
    let post = await this.db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.userId, userId)),
      with: withRelations,
    }) as PostWithAllData | undefined;

    // Org-member path: the post belongs to a business the user can access
    // as the business owner or a member of the business's organization.
    if (!post) {
      const probe = await this.db.query.posts.findFirst({
        where: eq(posts.id, postId),
        columns: { businessId: true },
      })
      if (!probe) {
        throw new Error('Post not found')
      }
      const accessibleBusinessIds = await this.getAccessibleBusinessIds(userId)
      if (!accessibleBusinessIds.includes(probe.businessId)) {
        throw new Error('Post not found')
      }
      post = await this.db.query.posts.findFirst({
        where: eq(posts.id, postId),
        with: withRelations,
      }) as PostWithAllData | undefined;
    }

    if (!post) {
      throw new Error('Post not found')
    }
    const assetsIds: string[] = post.mediaAssets ? JSON.parse(post.mediaAssets) : []
    if (assetsIds.length > 0) {
      const postAssets = await this.db.query.assets.findMany({
        where: inArray(assets.id, assetsIds),
      })
      const assetsById = new Map(postAssets.map(a => [a.id, a]))
      post.assets = assetsIds.map(id => assetsById.get(id)).filter((a): a is Asset => !!a)
    } else {
      post.assets = []
    }
    return post;
  }

  /**
   * Business IDs the requesting user can access: businesses they own directly,
   * OR businesses whose organization they are a member of (team access).
   * Mirrors the access model used by businessProfileService.findById() and
   * businessOrgService.getBusinessIdFromOrg().
   */
  private async getAccessibleBusinessIds(userId: string): Promise<string[]> {
    const owned = await this.db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))

    const ids = new Set(owned.map(b => b.id))

    // Organizations the user belongs to → their linked businessId (org metadata
    // is written server-side by businessOrgService at org creation time).
    const orgRows = await this.db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))

    if (orgRows.length > 0) {
      const orgIds = orgRows.map(r => r.organizationId)
      const orgs = await this.db
        .select({ id: organization.id, metadata: organization.metadata })
        .from(organization)
        .where(inArray(organization.id, orgIds))

      for (const org of orgs) {
        const meta = parseJsonObject(toJsonString(org.metadata))
        if (typeof meta.businessId === 'string' && meta.businessId) {
          ids.add(meta.businessId)
        }
      }
    }

    return [...ids]
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

        const updateData: Record<string, unknown> = {
          ...data,
          updatedAt: dayjs.utc().toDate()
        }

        // Handle JSON fields (empty arrays stringify too — raw arrays cannot bind)
        if (data.mediaAssets !== undefined) {
          updateData.mediaAssets = data.mediaAssets ? JSON.stringify(data.mediaAssets) : null
        }
        if (data.targetPlatforms !== undefined) {
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
        // Reconcile platform rows: keep what already published, retry only the
        // rows that did not, and add rows for newly targeted accounts.
        if (data.targetPlatforms) {
          await syncPlatformPostsAfterUpdate(tx, id, data, updateData.updatedAt as Date)
        }
        return { success: true, data: updated }
      })
    } catch (error) {
      log.error({ message: 'Error Updating post', error: String(error) })
      return { success: false, error: 'Failed to update post' }
    }
  }

  async updateStatus(id: string, userId: string, status: 'pending' | 'published' | 'failed'): Promise<ServiceResponse<Post>> {
    try {
      const updateData: Record<string, unknown> = {
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

  /**
   * Derive the post-level status from its platform rows instead of trusting the
   * last platform that finished. Only writes when the value changes, so
   * `publishedAt` is not rewritten by every later platform completion.
   */
  async recomputeStatusFromPlatforms(id: string, userId: string): Promise<ServiceResponse<Post>> {
    try {
      const rows = await this.db
        .select({ status: platformPosts.status })
        .from(platformPosts)
        .where(eq(platformPosts.postId, id))

      const current = await this.db.query.posts.findFirst({
        where: and(eq(posts.id, id), eq(posts.userId, userId)),
      })
      if (!current) {
        return { success: false, error: 'Post not found', code: 'NOT_FOUND' }
      }

      const status = aggregatePlatformStatus(rows.map(row => row.status))
      if (status === current.status) {
        return { success: true, data: current }
      }

      return this.updateStatus(id, userId, status)
    } catch {
      return { success: false, error: 'Failed to recompute post status' }
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
