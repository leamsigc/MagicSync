import { assetService } from '#layers/BaseShared/server/services/asset.service';
import { auth } from '#layers/BaseAuth/lib/auth';
import { getFileFromAsset } from '#layers/BaseShared/server/utils/asset-utils'
import { unlink } from 'fs/promises'
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Get request body
    const body = await readBody(event)
    log.set({ assetIdsCount: body.assetIds?.length || 0 })

    // Validate asset IDs
    if (!body.assetIds || !Array.isArray(body.assetIds) || body.assetIds.length === 0) {
      log.error('Asset IDs array is required and cannot be empty', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'Asset IDs array is required and cannot be empty'
      })
    }

    // Validate that all IDs are strings
    if (!body.assetIds.every((id: any) => typeof id === 'string')) {
      log.error('All asset IDs must be strings', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'All asset IDs must be strings'
      })
    }

    // Delete multiple assets
    const result = await assetService.deleteMultiple(body.assetIds, user.id)

    if (!result.success) {
      log.error('Failed to delete assets', { error: result.error })
      throw createError({
        statusCode: 500,
        statusMessage: result.error
      })
    }

    const removed = result.data ?? []
    let filesRemoved = 0
    for (const asset of removed) {
      if (!asset.url) continue
      try {
        await unlink(getFileFromAsset(asset))
        filesRemoved += 1
      } catch (fileError) {
        log.warn('Failed to remove stored file', { assetId: asset.id, error: fileError })
      }
    }

    log.info('Assets deleted successfully', { count: removed.length, filesRemoved })
    return {
      success: true,
      data: result.data,
      message: `Successfully deleted ${removed.length} asset(s)`
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
