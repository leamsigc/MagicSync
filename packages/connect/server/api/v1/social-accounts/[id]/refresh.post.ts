import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await requireUserSession(event)
    log.set({ userId: user.id })

    const accountId = getRouterParam(event, 'id')

    if (!accountId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Account ID is required'
      })
    }

    log.set({ accountId })

    // Get the account to verify ownership and get refresh token
    const account = await socialMediaAccountService.getAccountById(accountId)

    if (!account) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Social media account not found'
      })
    }

    // Verify user owns this account
    if (account.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }

    try {
      // Get fresh access token using Better Auth
      // Better Auth automatically handles token refresh internally
      const accessToken = await getAccessToken(event, account.platform as SocialMediaPlatform, accountId)

      if (!accessToken) {
        throw new Error('Failed to retrieve access token')
      }

      // Update account with successful token refresh
      const updatedAccount = await socialMediaAccountService.updateAccount(accountId, {
        isActive: true,
        lastSyncAt: new Date()
      })

      if (!updatedAccount) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to update account status'
        })
      }

      log.info('Access token refreshed', { accountId, platform: account.platform })

      return {
        success: true,
        message: 'Access token refreshed successfully',
        data: {
          id: updatedAccount.id,
          platform: updatedAccount.platform,
          accountName: updatedAccount.accountName,
          isActive: updatedAccount.isActive,
          lastSyncAt: updatedAccount.lastSyncAt,
          hasValidToken: true
        }
      }
    } catch (refreshError) {
      log.error('Token refresh failed', { accountId, error: refreshError })

      // Mark account as inactive if refresh fails
      await socialMediaAccountService.updateAccount(accountId, { isActive: false })

      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to refresh tokens. Account may need to be reconnected.'
      })
    }
  } catch (error) {
    log.error('Failed to refresh social media account tokens', { error })

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh account tokens'
    })
  }
})
