import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { bulkSchedulerService, type CsvImportRequest } from '#layers/BaseBulkScheduler/server/services/bulkScheduler.service'
import { parseFromBuffer } from '#layers/BaseBulkScheduler/utils/csvParser'

export default defineEventHandler(async (event) => {
  try {
    const user = await checkUserIsLogin(event)

    const formData = await readMultipartFormData(event)
    if (!formData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No form data provided'
      })
    }

    let csvData: Buffer | null = null
    let platforms: string[] = []
    let businessId = ''
    let startDate: Date | undefined
    let endDate: Date | undefined
    let distributeEvenly = false
    let selectedAssets: string[] = []

    for (const field of formData) {
      if (field.name === 'file' && field.data) {
        csvData = field.data
      } else if (field.name === 'platforms') {
        platforms = JSON.parse(field.data.toString())
      } else if (field.name === 'businessId') {
        businessId = field.data.toString()
      } else if (field.name === 'startDate') {
        startDate = new Date(field.data.toString())
      } else if (field.name === 'endDate') {
        endDate = new Date(field.data.toString())
      } else if (field.name === 'distributeEvenly') {
        distributeEvenly = field.data.toString() === 'true'
      } else if (field.name === 'selectedAssets') {
        selectedAssets = JSON.parse(field.data.toString())
      }
    }

    if (!csvData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'CSV file is required'
      })
    }

    if (!businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    if (!platforms || platforms.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one platform is required'
      })
    }

    const parseResult = await parseFromBuffer(csvData)
    if (!parseResult.success || !parseResult.data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'CSV parsing failed',
        data: { errors: parseResult.errors }
      })
    }

    const request: CsvImportRequest = {
      posts: parseResult.data,
      platforms,
      businessId,
      dateRange: startDate && endDate ? { startDate, endDate } : undefined,
      distributeEvenly,
      selectedAssets
    }

    const result = await bulkSchedulerService.bulkCreateFromCsv(user.id, request)

    if (!result.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to import posts from CSV',
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
