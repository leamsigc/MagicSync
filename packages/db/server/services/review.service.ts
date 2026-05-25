import type { H3Event } from 'h3'
import type { Review } from '#layers/BaseDB/db/schema'
import type {
  PaginatedResponse,
  QueryOptions,
  ServiceResponse
} from './types'
import type { ReviewServiceType } from './interfaces'
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import { businessProfiles, reviews } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import {
  createGMBClient,
  formatReviewForStorage
} from '#layers/BaseDB/server/utils/googleMyBusiness'
import {
  ValidationError
} from './types'
import { businessProfileService } from './business-profile.service'

export interface CreateReviewData {
  businessId: string
  platform: string
  platformReviewId: string
  authorName: string
  authorImage?: string
  rating: number
  content: string
  reviewDate: Date
}

export interface UpdateReviewData {
  responseContent?: string
  responseDate?: Date
  isShared?: boolean
}

export interface ReviewStats {
  totalReviews: number
  averageRating: number
  ratingDistribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
  responseRate: number
  shareRate: number
}

export class ReviewService implements ReviewServiceType {
  private db = useDrizzle()

  async create(data: CreateReviewData): Promise<ServiceResponse<Review>> {
    try {
      this.validateCreateData(data)

      const id = crypto.randomUUID()
      const now = new Date()

      const [review] = await this.db.insert(reviews).values({
        id,
        ...data,
        createdAt: now,
        updatedAt: now
      }).returning()

      return { success: true, data: review }
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message, code: error.code }
      }
      return { success: false, error: 'Failed to create review' }
    }
  }

  /**
   * Verify that the user owns the business associated with a review.
   * Returns the business profile if owned, null otherwise.
   */
  private async verifyBusinessOwnership(
    review: Review,
    userId: string,
    event?: H3Event
  ): Promise<ServiceResponse<void>> {
    try {
      // Check direct ownership via businessProfiles
      const [profile] = await this.db
        .select()
        .from(businessProfiles)
        .where(and(
          eq(businessProfiles.id, review.businessId),
          eq(businessProfiles.userId, userId)
        ))
        .limit(1)

      if (profile) return { success: true, data: undefined }

      // Fall back to org membership check if event is available
      if (!event) {
        return { success: false, error: 'Not authorized to access this review', code: 'UNAUTHORIZED' }
      }

      // useAuthApi is auto-imported globally by Nuxt from
      // packages/auth/server/utils/useAuthApi — no static import needed.
      const authApi = (useAuthApi as (e: H3Event) => ReturnType<typeof useAuthApi>)(event)
      const orgMembers = await authApi.listOrgMembers(userId)
      const isOrgMember = orgMembers.some(member => member.userId === review.businessId)

      if (!isOrgMember) {
        return { success: false, error: 'Not authorized to access this review', code: 'UNAUTHORIZED' }
      }

      return { success: true, data: undefined }
    } catch (error) {
      return { success: false, error: 'Failed to verify business ownership' }
    }
  }

  async findById(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<Review>> {
    try {
      const [review] = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, id))
        .limit(1)

      if (!review) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      // Verify user owns the business
      const ownershipCheck = await this.verifyBusinessOwnership(review, userId, event)
      if (ownershipCheck.error) {
        return { success: false, error: ownershipCheck.error, code: ownershipCheck.code }
      }

      return { success: true, data: review }
    } catch (error) {
      return { success: false, error: 'Failed to fetch review' }
    }
  }

  async findByBusinessId(businessId: string, userId: string, options: QueryOptions = {}, event?: H3Event): Promise<PaginatedResponse<Review>> {
    try {
      // Verify user owns the business
      const ownershipCheck = await businessProfileService.findById(businessId, userId, event)
      if (ownershipCheck.error) {
        return { success: false, error: ownershipCheck.error, code: ownershipCheck.code }
      }

      const { pagination = { page: 1, limit: 10 }, filters = {}, sort } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 10)

      let whereConditions: SQL<unknown> = eq(reviews.businessId, businessId)

      // Apply filters
      const conditions: SQL<unknown>[] = [whereConditions]

      if (filters.platform) {
        conditions.push(eq(reviews.platform, filters.platform))
      }
      if (filters.minRating !== undefined) {
        conditions.push(gte(reviews.rating, filters.minRating))
      }
      if (filters.maxRating !== undefined) {
        conditions.push(lte(reviews.rating, filters.maxRating))
      }
      if (filters.hasResponse !== undefined) {
        if (filters.hasResponse) {
          conditions.push(sql`${reviews.responseContent} IS NOT NULL`)
        } else {
          conditions.push(sql`${reviews.responseContent} IS NULL`)
        }
      }
      if (filters.isShared !== undefined) {
        conditions.push(eq(reviews.isShared, filters.isShared))
      }
      if (filters.startDate) {
        conditions.push(gte(reviews.reviewDate, new Date(filters.startDate)))
      }
      if (filters.endDate) {
        conditions.push(lte(reviews.reviewDate, new Date(filters.endDate)))
      }

      whereConditions = and(...conditions)!

      let query = this.db
        .select()
        .from(reviews)
        .where(whereConditions)

      // Apply sorting
      if (sort?.field === 'rating') {
        query = sort.direction === 'desc'
          ? query.orderBy(desc(reviews.rating))
          : query.orderBy(reviews.rating)
      } else if (sort?.field === 'reviewDate') {
        query = sort.direction === 'desc'
          ? query.orderBy(desc(reviews.reviewDate))
          : query.orderBy(reviews.reviewDate)
      } else {
        // Default sort by review date descending
        query = query.orderBy(desc(reviews.reviewDate))
      }

      const reviewList = await query
        .limit(pagination.limit || 10)
        .offset(offset)

      // Get total count for pagination
      const countResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(whereConditions)

      const total = countResult[0]?.count || 0

      return {
        data: reviewList,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total,
          totalPages: Math.ceil(total / (pagination.limit || 10))
        }
      }
    } catch (error) {
      return { success: false, error: 'Failed to fetch reviews' }
    }
  }

  async findByPlatformReviewId(platform: string, platformReviewId: string): Promise<ServiceResponse<Review>> {
    try {
      const [review] = await this.db
        .select()
        .from(reviews)
        .where(and(
          eq(reviews.platform, platform),
          eq(reviews.platformReviewId, platformReviewId)
        ))
        .limit(1)

      if (!review) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: review }
    } catch (error) {
      return { success: false, error: 'Failed to fetch review' }
    }
  }

  async update(id: string, userId: string, data: UpdateReviewData, event?: H3Event): Promise<ServiceResponse<Review>> {
    try {
      // First verify ownership
      const [review] = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, id))
        .limit(1)

      if (!review) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      const ownershipCheck = await this.verifyBusinessOwnership(review, userId, event)
      if (ownershipCheck.error) {
        return { success: false, error: ownershipCheck.error, code: ownershipCheck.code }
      }

      const [updated] = await this.db
        .update(reviews)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(reviews.id, id))
        .returning()

      if (!updated) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to update review' }
    }
  }

  async addResponse(id: string, userId: string, responseContent: string, event?: H3Event): Promise<ServiceResponse<Review>> {
    try {
      if (!responseContent || responseContent.trim().length === 0) {
        return { success: false, error: 'Response content is required', code: 'VALIDATION_ERROR' }
      }

      // First verify ownership
      const [review] = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, id))
        .limit(1)

      if (!review) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      const ownershipCheck = await this.verifyBusinessOwnership(review, userId, event)
      if (ownershipCheck.error) {
        return { success: false, error: ownershipCheck.error, code: ownershipCheck.code }
      }

      const [updated] = await this.db
        .update(reviews)
        .set({
          responseContent: responseContent.trim(),
          responseDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(reviews.id, id))
        .returning()

      if (!updated) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to add response' }
    }
  }

  async toggleShare(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<Review>> {
    try {
      // First get the current state with ownership verification
      const currentResult = await this.findById(id, userId, event)
      if (currentResult.error) {
        return { success: false, error: currentResult.error, code: currentResult.code }
      }

      const [updated] = await this.db
        .update(reviews)
        .set({
          isShared: !currentResult.data!.isShared,
          updatedAt: new Date()
        })
        .where(eq(reviews.id, id))
        .returning()

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to toggle share status' }
    }
  }

  async getStats(businessId: string, userId: string, options: { startDate?: Date, endDate?: Date } = {}, event?: H3Event): Promise<ServiceResponse<ReviewStats>> {
    try {
      // Verify user owns the business
      const ownershipCheck = await businessProfileService.findById(businessId, userId, event)
      if (ownershipCheck.error) {
        return { success: false, error: ownershipCheck.error, code: ownershipCheck.code }
      }

      let whereConditions: SQL<unknown> = eq(reviews.businessId, businessId)
      const conditions: SQL<unknown>[] = [whereConditions]

      if (options.startDate) {
        conditions.push(gte(reviews.reviewDate, options.startDate))
      }
      if (options.endDate) {
        conditions.push(lte(reviews.reviewDate, options.endDate))
      }

      whereConditions = and(...conditions)!

      // Get basic stats
      const statsResult = await this.db
        .select({
          totalReviews: sql<number>`COUNT(*)`,
          averageRating: sql<number>`COALESCE(ROUND(AVG(CAST(${reviews.rating} AS REAL)), 2), 0)`,
          totalWithResponse: sql<number>`COUNT(CASE WHEN ${reviews.responseContent} IS NOT NULL THEN 1 END)`,
          totalShared: sql<number>`COUNT(CASE WHEN ${reviews.isShared} = 1 THEN 1 END)`
        })
        .from(reviews)
        .where(whereConditions)

      const basicStats = statsResult[0] || { totalReviews: 0, averageRating: 0, totalWithResponse: 0, totalShared: 0 }

      // Get rating distribution
      const ratingDistribution = await this.db
        .select({
          rating: reviews.rating,
          count: sql<number>`COUNT(*)`
        })
        .from(reviews)
        .where(whereConditions)
        .groupBy(reviews.rating)

      // Build rating distribution object
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      ratingDistribution.forEach(({ rating, count }) => {
        if (rating >= 1 && rating <= 5) {
          distribution[rating as keyof typeof distribution] = count
        }
      })

      const stats: ReviewStats = {
        totalReviews: basicStats.totalReviews,
        averageRating: basicStats.averageRating || 0,
        ratingDistribution: distribution,
        responseRate: basicStats.totalReviews > 0
          ? Math.round((basicStats.totalWithResponse / basicStats.totalReviews) * 100)
          : 0,
        shareRate: basicStats.totalReviews > 0
          ? Math.round((basicStats.totalShared / basicStats.totalReviews) * 100)
          : 0
      }

      return { success: true, data: stats }
    } catch (error) {
      return { success: false, error: 'Failed to get review stats' }
    }
  }

  async getRecentReviews(businessId: string, userId: string, limit: number = 5, event?: H3Event): Promise<ServiceResponse<Review[]>> {
    try {
      // Verify user owns the business
      const ownershipCheck = await businessProfileService.findById(businessId, userId, event)
      if (ownershipCheck.error) {
        return { success: false, error: ownershipCheck.error, code: ownershipCheck.code }
      }

      const recentReviews = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.businessId, businessId))
        .orderBy(desc(reviews.reviewDate))
        .limit(limit)

      return { success: true, data: recentReviews }
    } catch (error) {
      return { success: false, error: 'Failed to fetch recent reviews' }
    }
  }

  async delete(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<void>> {
    try {
      // First verify ownership
      const [review] = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, id))
        .limit(1)

      if (!review) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      const ownershipCheck = await this.verifyBusinessOwnership(review, userId, event)
      if (ownershipCheck.error) {
        return { success: false, error: ownershipCheck.error, code: ownershipCheck.code }
      }

      await this.db
        .delete(reviews)
        .where(eq(reviews.id, id))

      return { success: true, data: undefined }
    } catch (error) {
      return { success: false, error: 'Failed to delete review' }
    }
  }

  /**
   * Sync reviews from Google My Business for a specific business
   */
  async syncGMBReviews(businessId: string, googleBusinessId: string, accessToken: string): Promise<ServiceResponse<Review[]>> {
    try {
      const gmbClient = createGMBClient(accessToken)

      // Fetch reviews from GMB
      const gmbReviews = await gmbClient.getReviews(googleBusinessId)
      const syncedReviews: Review[] = []

      for (const gmbReview of gmbReviews) {
        const formattedReview = formatReviewForStorage(gmbReview, businessId)

        // Check if review already exists
        const existingResult = await this.findByPlatformReviewId('google_my_business', formattedReview.platformReviewId)

        if (existingResult.data) {
          // Update existing review (internal call - no ownership check)
          const updateData: UpdateReviewData = {}
          if (formattedReview.responseContent !== null) {
            updateData.responseContent = formattedReview.responseContent
          }
          if (formattedReview.responseDate !== null) {
            updateData.responseDate = formattedReview.responseDate
          }
          // Direct update without ownership check for internal sync
          const [updated] = await this.db
            .update(reviews)
            .set({
              ...updateData,
              updatedAt: new Date()
            })
            .where(eq(reviews.id, existingResult.data.id))
            .returning()
          if (updated) {
            syncedReviews.push(updated)
          }
        } else {
          // Create new review
          const createData: CreateReviewData = {
            businessId: formattedReview.businessId,
            platform: formattedReview.platform,
            platformReviewId: formattedReview.platformReviewId,
            authorName: formattedReview.authorName,
            authorImage: formattedReview.authorImage ?? undefined,
            rating: formattedReview.rating,
            content: formattedReview.content,
            reviewDate: formattedReview.reviewDate,
          }
          const createResult = await this.create(createData)
          if (createResult.data) {
            syncedReviews.push(createResult.data)
          }
        }
      }

      return { success: true, data: syncedReviews }
    } catch (error) {
      console.error('Error syncing GMB reviews:', error)
      return { success: false, error: 'Failed to sync reviews from Google My Business' }
    }
  }

  /**
   * Reply to a GMB review both locally and on the platform
   */
  async replyToGMBReview(reviewId: string, responseContent: string, accessToken: string): Promise<ServiceResponse<Review>> {
    try {
      // Get the review from local database (internal call - no userId needed for read)
      const [review] = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)

      if (!review) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      // Validate that this is a GMB review
      if (review.platform !== 'google_my_business') {
        return { success: false, error: 'This is not a Google My Business review', code: 'INVALID_PLATFORM' }
      }

      // Reply to the review on GMB
      const gmbClient = createGMBClient(accessToken)
      const reviewName = `accounts/${review.platformReviewId.split('/')[1]}/locations/${review.platformReviewId.split('/')[3]}/reviews/${review.platformReviewId.split('/')[5]}`

      await gmbClient.replyToReview(reviewName, responseContent)

      // Update local database (direct query - internal call)
      const [updated] = await this.db
        .update(reviews)
        .set({
          responseContent: responseContent.trim(),
          responseDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(reviews.id, reviewId))
        .returning()

      return { success: true, data: updated }
    } catch (error) {
      console.error('Error replying to GMB review:', error)
      return { success: false, error: 'Failed to reply to Google My Business review' }
    }
  }

  /**
   * Generate AI-powered review response
   */
  async generateAIResponse(reviewId: string, businessContext?: string): Promise<ServiceResponse<string>> {
    try {
      // Get review directly (internal call - no userId needed for read)
      const [review] = await this.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)

      if (!review) {
        return { success: false, error: 'Review not found', code: 'NOT_FOUND' }
      }

      // Simple AI response generation based on rating
      // In a real implementation, this would use an AI service like OpenAI
      let response = ''

      if (review.rating >= 4) {
        // Positive review responses
        const positiveResponses = [
          `Thank you so much for your wonderful review! We're thrilled to hear about your positive experience.`,
          `We truly appreciate your kind words and are delighted that you enjoyed your time with us.`,
          `Thank you for taking the time to share your feedback. We're so glad we could exceed your expectations!`,
          `Your review made our day! Thank you for choosing us and for sharing your experience.`
        ] as const
        response = positiveResponses[Math.floor(Math.random() * positiveResponses.length)] as string
      } else if (review.rating === 3) {
        // Neutral review responses
        const neutralResponses = [
          `Thank you for your feedback. We appreciate you taking the time to share your experience and will use it to improve.`,
          `We value your honest review and are always looking for ways to enhance our service. Thank you for your input.`,
          `Thank you for your review. We'd love to learn more about how we can better serve you in the future.`
        ] as const
        response = neutralResponses[Math.floor(Math.random() * neutralResponses.length)] as string
      } else {
        // Negative review responses
        const negativeResponses = [
          `We sincerely apologize for not meeting your expectations. Your feedback is valuable to us and we're committed to improving.`,
          `Thank you for bringing this to our attention. We take all feedback seriously and would like to make this right.`,
          `We're sorry to hear about your experience. Please reach out to us directly so we can address your concerns.`,
          `We apologize for the inconvenience. Your feedback helps us identify areas for improvement.`
        ] as const
        response = negativeResponses[Math.floor(Math.random() * negativeResponses.length)] as string
      }

      // Add business context if provided
      if (businessContext) {
        response += ` ${businessContext}`
      }

      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: 'Failed to generate AI response' }
    }
  }

  /**
   * Get reviews that need responses (no response yet)
   */
  async getReviewsNeedingResponse(businessId: string, platform?: string): Promise<ServiceResponse<Review[]>> {
    try {
      let whereConditions = and(
        eq(reviews.businessId, businessId),
        sql`${reviews.responseContent} IS NULL`
      )

      if (platform) {
        whereConditions = and(whereConditions, eq(reviews.platform, platform))
      }

      const reviewsNeedingResponse = await this.db
        .select()
        .from(reviews)
        .where(whereConditions)
        .orderBy(desc(reviews.reviewDate))

      return { success: true, data: reviewsNeedingResponse }
    } catch (error) {
      return { success: false, error: 'Failed to fetch reviews needing response' }
    }
  }

  /**
   * Get 5-star reviews for sharing on social media
   */
  async getFiveStarReviewsForSharing(businessId: string, limit: number = 10): Promise<ServiceResponse<Review[]>> {
    try {
      const fiveStarReviews = await this.db
        .select()
        .from(reviews)
        .where(and(
          eq(reviews.businessId, businessId),
          eq(reviews.rating, 5),
          eq(reviews.isShared, false)
        ))
        .orderBy(desc(reviews.reviewDate))
        .limit(limit)

      return { success: true, data: fiveStarReviews }
    } catch (error) {
      return { success: false, error: 'Failed to fetch 5-star reviews for sharing' }
    }
  }

  /**
   * Mark a review as shared and optionally create a social media post
   */
  async markAsShared(reviewId: string, userId: string, event?: H3Event): Promise<ServiceResponse<Review>> {
    try {
      const updateResult = await this.update(reviewId, userId, { isShared: true }, event)
      return updateResult
    } catch (error) {
      return { success: false, error: 'Failed to mark review as shared' }
    }
  }

  /**
   * Get review response templates based on rating
   */
  getResponseTemplates(rating: number): string[] {
    if (rating >= 4) {
      return [
        'Thank you so much for your wonderful review! We\'re thrilled to hear about your positive experience.',
        'We truly appreciate your kind words and are delighted that you enjoyed your time with us.',
        'Thank you for taking the time to share your feedback. We\'re so glad we could exceed your expectations!',
        'Your review made our day! Thank you for choosing us and for sharing your experience.',
        'We\'re so grateful for customers like you! Thank you for your glowing review.'
      ]
    } else if (rating === 3) {
      return [
        'Thank you for your feedback. We appreciate you taking the time to share your experience and will use it to improve.',
        'We value your honest review and are always looking for ways to enhance our service. Thank you for your input.',
        'Thank you for your review. We\'d love to learn more about how we can better serve you in the future.',
        'We appreciate your feedback and are committed to continuous improvement based on customer input like yours.'
      ]
    } else {
      return [
        'We sincerely apologize for not meeting your expectations. Your feedback is valuable to us and we\'re committed to improving.',
        'Thank you for bringing this to our attention. We take all feedback seriously and would like to make this right.',
        'We\'re sorry to hear about your experience. Please reach out to us directly so we can address your concerns.',
        'We apologize for the inconvenience. Your feedback helps us identify areas for improvement.',
        'We\'re disappointed to hear about your experience and would appreciate the opportunity to make it right.'
      ]
    }
  }

  private validateCreateData(data: CreateReviewData): void {
    if (!data.businessId || data.businessId.trim().length === 0) {
      throw new ValidationError('Business ID is required', 'businessId')
    }

    if (!data.platform || data.platform.trim().length === 0) {
      throw new ValidationError('Platform is required', 'platform')
    }

    if (!data.platformReviewId || data.platformReviewId.trim().length === 0) {
      throw new ValidationError('Platform review ID is required', 'platformReviewId')
    }

    if (!data.authorName || data.authorName.trim().length === 0) {
      throw new ValidationError('Author name is required', 'authorName')
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new ValidationError('Review content is required', 'content')
    }

    if (data.rating < 1 || data.rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5', 'rating')
    }

    if (!data.reviewDate) {
      throw new ValidationError('Review date is required', 'reviewDate')
    }
  }
}

export const reviewService = new ReviewService()
