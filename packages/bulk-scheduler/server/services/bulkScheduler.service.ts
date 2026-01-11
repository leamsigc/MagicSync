import { postService } from '#layers/BaseDB/server/services/post.service';
import type { PostCreateBase } from '#layers/BaseDB/db/schema'
import { distributePostsAcrossDates, calculateTotalDays, type DateDistributionOptions } from '../../utils/dateDistribution'
import { processTemplate, type SystemVariable } from '../../utils/templateProcessor'
import { validateBulkPosts } from '../../utils/validators'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

export type BulkScheduleResult = {
  success: boolean
  created?: number
  failed?: number
  errors?: string[]
  postIds?: string[]
}

export type BulkGenerateRequest = {
  templateContent: string
  variables: SystemVariable[]
  platforms: string[]
  businessId: string
  dateRange: {
    startDate: Date
    endDate: Date
  }
  postsPerDay: number
  skipWeekends?: boolean
  businessHoursOnly?: boolean
  firstComment?: string
}

export type CsvImportRequest = {
  posts: PostCreateBase[]
  platforms: string[]
  businessId: string
  dateRange?: {
    startDate: Date
    endDate: Date
  }
  distributeEvenly?: boolean
}

export class BulkSchedulerService {
  async bulkCreateFromCsv(userId: string, request: CsvImportRequest): Promise<BulkScheduleResult> {
    try {
      const { posts, platforms, businessId, dateRange, distributeEvenly } = request

      const enrichedPosts = posts.map((post, index) => {
        const enriched = { ...post }
        enriched.businessId = businessId
        enriched.targetPlatforms = platforms

        if (distributeEvenly && dateRange) {
          const distributedDates = distributePostsAcrossDates(posts.length, {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            postsPerDay: 1
          })
          enriched.scheduledAt = distributedDates[index]?.date || null
        }

        return enriched
      })

      const validationErrors = validateBulkPosts(enrichedPosts)
      if (validationErrors.length > 0) {
        const errors = validationErrors.map(e => `Row ${e.row || 'unknown'}: ${e.message}`)
        await this.logOperationNotification(userId, 'error', 'CSV Import Failed', `Validation failed for ${errors.length} rows.`, { errors })
        return {
          success: false,
          errors
        }
      }

      const results = await this.createPostsBatch(userId, enrichedPosts)

      if (results.success) {
        await this.logOperationNotification(userId, 'success', 'CSV Import Successful', `Successfully scheduled ${results.created} posts from CSV.`)
      } else {
        await this.logOperationNotification(userId, 'warning', 'CSV Import Partial Success',
          `Scheduled ${results.created} posts, but ${results.failed} failed.`,
          { errors: results.errors }
        )
      }

      return results
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create posts from CSV'
      await this.logOperationNotification(userId, 'error', 'CSV Import Error', errorMessage)
      return {
        success: false,
        errors: [errorMessage]
      }
    }
  }

  async bulkGenerate(userId: string, request: BulkGenerateRequest): Promise<BulkScheduleResult> {
    try {
      const {
        templateContent,
        variables,
        platforms,
        businessId,
        dateRange,
        postsPerDay,
        skipWeekends = false,
        businessHoursOnly = false,
        firstComment
      } = request

      const totalDays = calculateTotalDays(dateRange.startDate, dateRange.endDate, skipWeekends)
      const totalPosts = totalDays * postsPerDay

      const distributedDates = distributePostsAcrossDates(totalPosts, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        postsPerDay,
        skipWeekends,
        businessHoursOnly
      })

      const posts: PostCreateBase[] = distributedDates.map((dist) => {
        const dateVariables: SystemVariable[] = [
          ...variables,
          { key: 'date', value: dist.date.toLocaleDateString() },
          { key: 'time', value: dist.date.toLocaleTimeString() },
          { key: 'day', value: dist.date.toLocaleDateString('en-US', { weekday: 'long' }) }
        ]

        const processed = processTemplate(templateContent, {
          variables: dateVariables,
          strict: false
        })

        const comments: string[] = []
        if (firstComment) {
          const processedComment = processTemplate(firstComment, {
            variables: dateVariables,
            strict: false
          })
          comments.push(processedComment.content)
        }

        return {
          businessId,
          content: processed.content,
          mediaAssets: [],
          targetPlatforms: platforms,
          scheduledAt: dist.date,
          status: 'pending',
          comment: comments,
          platformContent: {},
          platformSettings: {},
          postFormat: 'post'
        }
      })

      const validationErrors = validateBulkPosts(posts)
      if (validationErrors.length > 0) {
        const errors = validationErrors.map(e => e.message)
        await this.logOperationNotification(userId, 'error', 'Bulk Generation Failed', `Validation failed for ${errors.length} generated posts.`, { errors })
        return {
          success: false,
          errors
        }
      }

      const results = await this.createPostsBatch(userId, posts)

      if (results.success) {
        await this.logOperationNotification(userId, 'success', 'Bulk Generation Successful', `Successfully generated and scheduled ${results.created} posts.`)
      } else {
        await this.logOperationNotification(userId, 'warning', 'Bulk Generation Partial Success',
          `Generated ${results.created} posts, but ${results.failed} failed.`,
          { errors: results.errors }
        )
      }

      return results
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate bulk posts'
      await this.logOperationNotification(userId, 'error', 'Bulk Generation Error', errorMessage)
      return {
        success: false,
        errors: [errorMessage]
      }
    }
  }

  private async createPostsBatch(userId: string, posts: PostCreateBase[]): Promise<BulkScheduleResult> {
    const createdIds: string[] = []
    const errors: string[] = []

    for (const post of posts) {
      try {
        const result = await postService.create(userId, post)
        if (result.data) {
          createdIds.push(result.data.id)
        } else if (result.error) {
          errors.push(result.error)
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create post'
        errors.push(errorMessage)
      }
    }

    return {
      success: errors.length === 0,
      created: createdIds.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      postIds: createdIds
    }
  }

  private async logOperationNotification(
    userId: string,
    type: 'success' | 'info' | 'warning' | 'error',
    title: string,
    message: string,
    metadata?: any
  ) {
    try {
      await notificationService.createNotification(userId, {
        type,
        title,
        message,
        metadata
      })
    } catch (error) {
      console.error('Failed to log bulk operation notification:', error)
    }
  }
}

export const bulkSchedulerService = new BulkSchedulerService()
