import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

const STATE_COOKIE_MAX_AGE = 60 * 10 // 10 minutes


export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const BASE_URL = process.env.NUXT_BASE_URL

  try {
    const platform = getRouterParam(event, 'platform') as SocialMediaPlatform
    log.set({ platform })

    const query = getQuery(event)

    const state = query.state as string
    const error = query.error as string

    // Validate required state parameter for CSRF protection
    if (!state) {
      log.error('OAuth callback missing state parameter')
      throw createError({
        statusCode: 400,
        statusMessage: 'OAuth state parameter is required'
      })
    }

    // Validate state format (must be base64url encoded JSON)
    let statePayload: { businessId: string; timestamp: number }
    try {
      const decodedState = Buffer.from(state, 'base64url').toString('utf-8')
      statePayload = JSON.parse(decodedState)
    } catch {
      log.error('OAuth callback has invalid state format')
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid OAuth state format'
      })
    }

    // Validate state payload structure
    if (!statePayload.businessId || typeof statePayload.businessId !== 'string') {
      log.error('OAuth state missing valid businessId')
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid OAuth state: missing businessId'
      })
    }

    // Validate state timestamp (prevent replay attacks - state valid for 10 minutes)
    const now = Date.now()
    const stateAge = (now - statePayload.timestamp) / 1000 // in seconds
    if (stateAge > STATE_COOKIE_MAX_AGE || stateAge < -60) {
      log.error('OAuth state has expired or is invalid', { stateAge, maxAge: STATE_COOKIE_MAX_AGE })
      throw createError({
        statusCode: 400,
        statusMessage: 'OAuth state has expired. Please try connecting again.'
      })
    }

    // Use businessId from validated state instead of untrusted query param
    const businessId = statePayload.businessId

    // Handle OAuth errors
    if (error) {
      log.error('OAuth error during callback', { platform, error })
      throw createError({
        statusCode: 400,
        statusMessage: `OAuth error: ${error}`
      })
    }

    // Get current user session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

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

    log.info('OAuth callback successful', { platform, userId: user.id })

    sendRedirect(event, '/app/integrations')

  } catch (error) {
    log.error('Error handling OAuth callback', { error })

    // Redirect to error page
    const baseUrl = BASE_URL || 'http://localhost:3000'
    const errorMessage = error instanceof Error
      ? error.message
      : (error as { statusMessage?: string })?.statusMessage || 'Connection failed'
    const errorUrl = `${baseUrl}/app/integrations?error=${encodeURIComponent(errorMessage)}`

    return sendRedirect(event, errorUrl)
  }
})
