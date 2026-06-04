import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

defineRouteMeta({
  openAPI: {
    tags: ['Connection'],
    operationId: 'getSocialMediaAccountSettings',
    summary: 'Get Social Media Account Settings',
    description: 'Get connection settings including managers and available users/businesses',
  },
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const accountId = getRouterParam(event, 'id')

    if (!accountId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Account ID is required',
      })
    }

    log.set({ accountId })

    const settings = await socialMediaAccountService.getConnectionSettings(accountId, user.id)

    if (!settings) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Connection not found or access denied',
      })
    }

    log.info({ message: 'Retrieved connection settings', accountId })

    return settings
  } catch (error) {
    log.error({ message: 'Failed to get connection settings', error })

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get connection settings',
    })
  }
})
