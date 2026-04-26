import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { auth } from "#layers/BaseAuth/lib/auth"


export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Get query parameters
    const query = getQuery(event)
    const businessId = query.businessId as string
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 200
    const mimeType = query.mimeType as string

    const own = query.own as string
    if (own === 'true') {
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
      throw createError({
        statusCode: 500,
        statusMessage: result.error
      })
    }

    return {
      success: true,
      data: result.data,
      pagination: result.pagination
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
