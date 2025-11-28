import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"


export default defineEventHandler(async (event) => {
  const { NUXT_BASE_URL } = useRuntimeConfig(event)

  try {
    const platform = getRouterParam(event, 'platform') as SocialMediaPlatform
    const query = getQuery(event)

    const businessId = query.businessId as string
    const error = query.error as string

    // Handle OAuth errors
    if (error) {
      throw createError({
        statusCode: 400,
        statusMessage: `OAuth error: ${error}`
      })
    }

    // Get current user session (Better Auth should have handled the OAuth flow)
    const user = await checkUserIsLogin(event)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'User session not found after OAuth callback'
      })
    }

    if (!businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    try {
      // Get user info from the connected social account
      // Note: We'll need the accountId from Better Auth's account linking
      // For now, we'll use a placeholder approach
      const userInfo = await getUserInfo(platform, user.id)
      if (!userInfo || !userInfo.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'User info not found after OAuth callback'
        })
      }

      // Check if account already exists
      const existingAccount = await socialMediaAccountService.getAccountByPlatformAndAccountId(
        user.id,
        platform,
        userInfo.id
      )

      let account
      if (existingAccount) {
        // Update existing account
        account = await socialMediaAccountService.updateAccount(existingAccount.id, {
          accountName: userInfo.name,
          isActive: true,
          lastSyncAt: new Date()
        })
      } else {
        // Create new account record
        account = await socialMediaAccountService.createAccount({
          userId: user.id,
          businessId,
          platform,
          accountId: userInfo.id,
          accountName: userInfo.name,
          // Better Auth manages tokens internally, so we don't store them
          accessToken: '',
        })
      }

      // Redirect to success page
      const baseUrl = NUXT_BASE_URL || 'http://localhost:3000'
      const successUrl = `${baseUrl}/app/social-accounts?connected=${platform}`

      return sendRedirect(event, successUrl)
    } catch (userInfoError) {
      const baseUrl = NUXT_BASE_URL || 'http://localhost:3000'
      return sendRedirect(event, `${baseUrl}/app/integrations`)
    }
  } catch (error) {
    console.error('Error handling OAuth callback:', error)

    // Redirect to error page
    const baseUrl = NUXT_BASE_URL || 'http://localhost:3000'
    const errorMessage = error instanceof Error
      ? error.message
      : (error as any)?.statusMessage || 'Connection failed'
    const errorUrl = `${baseUrl}/app/social-accounts?error=${encodeURIComponent(errorMessage)}`

    return sendRedirect(event, errorUrl)
  }
})
