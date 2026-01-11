import { postService } from '#layers/BaseDB/server/services/post.service';
import type { PostCreateBase } from '#layers/BaseDB/db/schema'
import { distributePostsAcrossDates, calculateTotalDays, type DateDistributionOptions } from '../../utils/dateDistribution'
import { processTemplate, type SystemVariable } from '../../utils/templateProcessor'
import { validateBulkPosts } from '../../utils/validators'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants'
import type { PlatformContentOverride } from '#layers/BaseDB/db/posts/posts'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'

export type BulkScheduleResult = {
  success: boolean
  created?: number
  failed?: number
  errors?: string[]
  postIds?: string[]
}

export type BulkGenerateRequest = {
  templateContent: string
  variables: string[] // Variable keys to match with contentRows
  contentRows: Record<string, string>[] // Data for each post
  platforms: string[]
  businessId: string
  dateRange: {
    startDate: Date
    endDate: Date
  }
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
        contentRows,
        platforms,
        businessId,
        dateRange,
        skipWeekends = false,
        businessHoursOnly = false,
        firstComment
      } = request

      if (!contentRows || contentRows.length === 0) {
        return { success: false, errors: ['No content rows provided'] }
      }

      const totalPosts = contentRows.length
      const totalDays = calculateTotalDays(dateRange.startDate, dateRange.endDate, skipWeekends)
      const postsPerDay = totalDays > 0 ? Math.ceil(totalPosts / totalDays) : 1

      const distributedDates = distributePostsAcrossDates(totalPosts, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        postsPerDay,
        skipWeekends,
        businessHoursOnly
      })

      const accountPlatforms = await Promise.all(
        platforms.map(async (id) => {
          const account = await socialMediaAccountService.getAccountById(id)
          return { id, platform: account?.platform || 'default' }
        })
      )

      const posts: PostCreateBase[] = contentRows.map((row, index) => {
        const dist = distributedDates[index]
        const rowVariables: SystemVariable[] = Object.entries(row).map(([key, value]) => ({
          key,
          value
        }))

        if (dist) {
          rowVariables.push(
            { key: 'date', value: dist.date.toLocaleDateString() },
            { key: 'time', value: dist.date.toLocaleTimeString() },
            { key: 'day', value: dist.date.toLocaleDateString('en-US', { weekday: 'long' }) }
          )
        }

        const processed = processTemplate(templateContent, {
          variables: rowVariables,
          strict: false
        })

        const comments: string[] = []
        if (firstComment) {
          const processedComment = processTemplate(firstComment, {
            variables: rowVariables,
            strict: false
          })
          comments.push(processedComment.content)
        }

        // Platform-specific content trimming
        const platformContent: Record<string, PlatformContentOverride> = {}

        accountPlatforms.forEach(({ id, platform }) => {
          const { content: trimmedContent, comments: updatedComments } = this.trimContentForPlatform(
            processed.content,
            platform,
            [...comments]
          )

          platformContent[id] = {
            content: trimmedContent,
            comments: updatedComments
          }
        })

        return {
          businessId,
          content: processed.content,
          mediaAssets: [],
          targetPlatforms: platforms,
          scheduledAt: dist?.date || null,
          status: 'pending',
          comment: comments,
          platformContent,
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

  private trimContentForPlatform(content: string, platform: string, currentComments: string[]): { content: string, comments: string[] } {
    const config = platformConfigurations[platform as keyof typeof platformConfigurations] || platformConfigurations.default
    const limit = config.maxPostLength

    if (content.length <= limit) {
      return { content, comments: currentComments }
    }

    // Smart trimming: try to find a paragraph or sentence break
    let trimmed = content.substring(0, limit)
    let remaining = content.substring(limit)

    // Try to find the last double newline (paragraph break) within the limit
    const lastParagraph = trimmed.lastIndexOf('\n\n')
    if (lastParagraph > limit * 0.5) {
      trimmed = content.substring(0, lastParagraph)
      remaining = content.substring(lastParagraph).trim()
    } else {
      // Try single newline
      const lastNewline = trimmed.lastIndexOf('\n')
      if (lastNewline > limit * 0.7) {
        trimmed = content.substring(0, lastNewline)
        remaining = content.substring(lastNewline).trim()
      } else {
        // Try last space (word break)
        const lastSpace = trimmed.lastIndexOf(' ')
        if (lastSpace > limit * 0.8) {
          trimmed = content.substring(0, lastSpace)
          remaining = content.substring(lastSpace).trim()
        }
      }
    }

    const newComments = [...currentComments]
    if (remaining) {
      newComments.push(remaining)
    }

    return { content: trimmed.trim(), comments: newComments }
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
