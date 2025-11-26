import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { auth } from '#layers/BaseAuth/lib/auth';
export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Get request body
    const body = await readBody(event)

    // Validate asset IDs
    if (!body.assetIds || !Array.isArray(body.assetIds) || body.assetIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Asset IDs array is required and cannot be empty'
      })
    }

    // Validate that all IDs are strings
    if (!body.assetIds.every((id: any) => typeof id === 'string')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'All asset IDs must be strings'
      })
    }

    // Delete multiple assets
    const result = await assetService.deleteMultiple(body.assetIds, user.id)

    if (!result.success) {
      throw createError({
        statusCode: 500,
        statusMessage: result.error
      })
    }

    return {
      success: true,
      data: result.data,
      message: `Successfully deleted ${result.data?.length || 0} asset(s)`
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
