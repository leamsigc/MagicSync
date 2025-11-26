import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { auth } from '#layers/BaseAuth/lib/auth';


export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Get query parameters
    const query = getQuery(event)
    const businessId = query.businessId as string
    const assetIds = query.assetIds as string[];


    // Handle asset IDs search
    if (assetIds && assetIds.length > 0) {
      const ids = typeof assetIds === 'string' ? [assetIds] : assetIds
      const result = await assetService.findByIds(ids, user.id)

      if (!result.success) {
        console.log(result);

        throw createError({
          statusCode: 500,
          statusMessage: result.error
        })
      }

      return {
        success: true,
        data: result.data
      }
    }

    // Handle business-based search with filters
    if (!businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required for asset search'
      })
    }

    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 20
    const mimeType = query.mimeType as string
    const assetType = query.assetType as string

    // Build filters
    const filters: any = {}

    if (mimeType) {
      filters.mimeType = mimeType
    } else if (assetType) {
      // Convert asset type to mime type filter
      switch (assetType) {
        case 'image':
          filters.mimeType = 'image'
          break
        case 'video':
          filters.mimeType = 'video'
          break
        case 'document':
          filters.mimeType = 'application'
          break
      }
    }

    const options = {
      pagination: { page, limit },
      filters
    }

    // Search assets
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
