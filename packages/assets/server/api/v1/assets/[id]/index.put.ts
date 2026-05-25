import { assetService } from '#layers/BaseShared/server/services/asset.service';
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

    // Get request body
    const body = await readBody(event)

    // For now, we only support updating metadata
    // In a full implementation, you might support updating other fields
    if (!body.metadata) {
      log.error('Metadata is required for asset updates', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'Metadata is required for asset updates'
      })
    }

    // Update asset metadata
    const result = await assetService.updateMetadata(assetId, user.id, body.metadata)

    if (!result.success) {
      log.error('Failed to update asset metadata', { code: result.code, error: result.error })
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

    log.info('Asset metadata updated successfully', { assetId })
    return {
      success: true,
      data: result.data
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
