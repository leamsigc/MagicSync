import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"


export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await requireUserSession(event)

    const accountId = getRouterParam(event, 'id')

    if (!accountId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Account ID is required'
      })
    }

    // Get the account to verify ownership
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

    // Validate the account connection using Better Auth
    let isValid = false
    let needsRefresh = false

    try {
      // Try to get a valid access token - Better Auth will handle refresh if needed
      const accessToken = await getAccessToken(account.platform as SocialMediaPlatform, accountId)
      isValid = !!accessToken

      // Update account status if validation successful
      if (isValid) {
        await socialMediaAccountService.updateAccount(accountId, {
          isActive: true,
          lastSyncAt: new Date()
        })
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      isValid = false
      needsRefresh = true

      // Mark account as inactive if validation fails
      await socialMediaAccountService.updateAccount(accountId, {
        isActive: false
      })
    }

    return {
      success: true,
      data: {
        accountId,
        platform: account.platform,
        accountName: account.accountName,
        isValid,
        needsRefresh,
        isActive: isValid ? true : false,
        lastSyncAt: account.lastSyncAt,
        validatedAt: new Date()
      }
    }
  } catch (error) {
    console.error('Error validating social media account:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to validate social media account'
    })
  }
})
