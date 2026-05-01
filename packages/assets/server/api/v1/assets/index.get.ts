import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { auth } from "#layers/BaseAuth/lib/auth"


export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Get query parameters
    const query = getQuery(event)
    const businessId = query.businessId as string
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 200
    const mimeType = query.mimeType as string
    const own = query.own as string

    log.set({ businessId, pagination: { page, limit } })

    if (own === 'true') {
      log.info('Listing user assets', { userId: user.id, page, limit })
      return await assetService.findByUserId(user.id, { pagination: { page, limit }, filters: mimeType ? { mimeType } : {} })
    }

    // Build query options
    const options = {
      pagination: { page, limit },
      filters: mimeType ? { mimeType } : {}
    }

    // Fetch assets for the business
    const result = await assetService.findByBusinessId(businessId, user.id, options)

    if (!result.success) {
      log.error('Failed to fetch assets', { error: result.error })
      throw createError({
        statusCode: 500,
        statusMessage: result.error
      })
    }

    log.info('Assets listed successfully', { businessId, count: result.data?.length || 0 })
    return {
      success: true,
      data: result.data,
      pagination: result.pagination
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    log.error('Internal server error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
