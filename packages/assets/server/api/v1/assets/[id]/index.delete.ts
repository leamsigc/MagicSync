import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { auth } from '#layers/BaseAuth/lib/auth';

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })
    // Get asset ID from route parameters
    const assetId = getRouterParam(event, 'id')
    log.set({ assetId })

    if (!assetId) {
      log.error('Asset ID is required', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'Asset ID is required'
      })
    }

    // Delete the asset
    const result = await assetService.delete(assetId, user.id)

    if (!result.success) {
      log.error('Failed to delete asset', { code: result.code, error: result.error })
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

    log.info('Asset deleted successfully', { assetId })
    return {
      success: true,
      data: result.data,
      message: 'Asset deleted successfully'
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
