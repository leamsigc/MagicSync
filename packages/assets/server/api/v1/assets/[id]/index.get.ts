import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { auth } from '#layers/BaseAuth/lib/auth';

export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    // Get asset ID from route parameters
    const assetId = getRouterParam(event, 'id')

    if (!assetId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Asset ID is required'
      })
    }

    // Fetch the asset
    const result = await assetService.findById(assetId, user.id)

    if (!result.success) {
      if (result.code === 'NOT_FOUND') {
        throw createError({
          statusCode: 404,
          statusMessage: 'Asset not found'
        })
      }

      throw createError({
        statusCode: 500,
        statusMessage: result.error
      })
    }

    return {
      success: true,
      data: result.data
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
