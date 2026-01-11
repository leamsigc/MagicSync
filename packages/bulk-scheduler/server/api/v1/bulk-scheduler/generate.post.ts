import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import type { SystemVariable } from '#layers/BaseBulkScheduler/utils/templateProcessor'
import { bulkSchedulerService, type BulkGenerateRequest } from '#layers/BaseBulkScheduler/server/services/bulkScheduler.service'

export default defineEventHandler(async (event) => {
  try {
    const user = await checkUserIsLogin(event)

    const body = await readBody(event)

    if (!body.templateContent) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Template content is required'
      })
    }

    if (!body.platforms || !Array.isArray(body.platforms) || body.platforms.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one platform is required'
      })
    }

    if (!body.businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    if (!body.startDate || !body.endDate) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Date range (startDate and endDate) is required'
      })
    }

    if (!body.contentRows || !Array.isArray(body.contentRows) || body.contentRows.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one content row is required'
      })
    }

    const request: BulkGenerateRequest = {
      templateContent: body.templateContent,
      variables: body.variables || [],
      contentRows: body.contentRows,
      platforms: body.platforms,
      businessId: body.businessId,
      dateRange: {
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate)
      },
      skipWeekends: body.skipWeekends || false,
      businessHoursOnly: body.businessHoursOnly || false,
      firstComment: body.firstComment
    }

    const result = await bulkSchedulerService.bulkGenerate(user.id, request)

    if (!result.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to generate bulk posts',
        data: { errors: result.errors }
      })
    }

    return {
      success: true,
      data: {
        created: result.created,
        failed: result.failed,
        postIds: result.postIds
      }
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${errorMessage}`
    })
  }
})
