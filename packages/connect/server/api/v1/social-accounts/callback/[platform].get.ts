import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"


export default defineEventHandler(async (event) => {
  const { BASE_URL } = useRuntimeConfig(event)

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

    // Get current user session
    const user = await checkUserIsLogin(event)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'User session not found after OAuth callback'
      })
    }

    // Define Better Auth supported platforms (native + Generic OAuth)
    const betterAuthPlatforms: SocialMediaPlatform[] = [
      'facebook', 'instagram', 'threads', 'google', 'googlemybusiness',
      'reddit', 'discord', 'linkedin', 'linkedin-page', 'twitter', 'youtube', 'tiktok', 'dribbble'
    ]

    if (!betterAuthPlatforms.includes(platform)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Platform ${platform} is not supported`
      })
    }



  } catch (error) {
    console.error('Error handling OAuth callback:', error)

    // Redirect to error page
    const baseUrl = BASE_URL || 'http://localhost:3000'
    const errorMessage = error instanceof Error
      ? error.message
      : (error as any)?.statusMessage || 'Connection failed'
    const errorUrl = `${baseUrl}/app/integrations?error=${encodeURIComponent(errorMessage)}`

    return sendRedirect(event, errorUrl)
  }
})
