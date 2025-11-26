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

    // Get request body
    const body = await readBody(event)

    // For now, we only support updating metadata
    // In a full implementation, you might support updating other fields
    if (!body.metadata) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Metadata is required for asset updates'
      })
    }

    // Update asset metadata
    const result = await assetService.updateMetadata(assetId, user.id, body.metadata)

    if (!result.success) {
      if (result.code === 'NOT_FOUND') {
        throw createError({
          statusCode: 404,
          statusMessage: 'Asset not found'
        })
      }

      throw createError({
        statusCode: 400,
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
