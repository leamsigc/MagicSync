import { assetService } from '#layers/BaseShared/server/services/asset.service';
import { auth } from '#layers/BaseAuth/lib/auth';


export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Get query parameters
    const query = getQuery(event)
    const businessId = query.businessId as string
    log.set({ businessId })

    let result

    if (businessId) {
      log.info('Getting storage usage for business', { businessId })
      // Get storage usage for specific business
      result = await assetService.getStorageUsageByBusiness(businessId, user.id)
    } else {
      log.info('Getting total storage usage for user', {})
      // Get total storage usage for user
      result = await assetService.getStorageUsage(user.id)
    }

    if (!result.success) {
      log.error('Failed to get storage usage', { error: result.error })
      throw createError({
        statusCode: 500,
        statusMessage: result.error
      })
    }

    // Convert bytes to more readable format
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return { value: 0, unit: 'B' }

      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))

      return {
        value: parseFloat((bytes / Math.pow(k, i)).toFixed(2)),
        unit: sizes[i]
      }
    }

    const formattedSize = formatBytes(result.data?.totalSize || 0)

    log.info('Storage usage retrieved', { totalSize: result.data?.totalSize, count: result.data?.count })
    return {
      success: true,
      data: {
        totalSize: result.data?.totalSize || 0,
        count: result.data?.count || 0,
        formatted: {
          size: `${formattedSize.value} ${formattedSize.unit}`,
          count: `${result.data?.count || 0} file${(result.data?.count || 0) !== 1 ? 's' : ''}`
        }
      }
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
