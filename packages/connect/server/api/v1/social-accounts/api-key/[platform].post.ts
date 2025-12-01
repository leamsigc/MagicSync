import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"
import { checkUserIsLogin, encryptKey } from "#layers/BaseAuth/server/utils/AuthHelpers"
/**
 * API Key / Credential-based authentication endpoint
 * Handles: bluesky, devto, wordpress
 */
export default defineEventHandler(async (event) => {
  try {
    const platform = getRouterParam(event, 'platform') as SocialMediaPlatform
    const body = await readBody(event)

    // Verify user is logged in
    const user = await checkUserIsLogin(event)

    const { businessId, ...credentials } = body

    if (!businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    if (!credentials) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Credentials are required'
      })
    }

    // Platform-specific validation and account creation
    let accountInfo: { id: string; name: string; accessToken: string, baseUrl: string, username: string } | null = null

    switch (platform) {
      case 'bluesky': {
        // Bluesky uses username (handle/email) and app password
        const { username, password, baseUrl } = credentials

        if (!username || !password) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Bluesky requires username and password'
          })
        }

        // Validate credentials by attempting login
        try {
          const { AtpAgent } = await import('@atproto/api')
          const agent = new AtpAgent({ service: baseUrl || 'https://bsky.social' })
          await agent.login({ identifier: username, password })

          const toke = await encryptKey(password);
          // console.log(agent.session);


          accountInfo = {
            id: agent.session!.did,
            name: username,
            username,
            accessToken: toke,
            baseUrl: baseUrl || 'https://bsky.social'
          }
        } catch (error) {
          throw createError({
            statusCode: 401,
            statusMessage: 'Invalid Bluesky credentials'
          })
        }
        break
      }

      case 'devto': {
        // Dev.to uses API key
        const { apiKey } = credentials

        if (!apiKey) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Dev.to requires API key'
          })
        }

        // Validate API key by fetching user info
        try {
          const response = await fetch('https://dev.to/api/users/me', {
            headers: { 'api-key': apiKey }
          })

          if (!response.ok) {
            throw new Error('Invalid API key')
          }

          const userData = await response.json()
          accountInfo = {
            id: String(userData.id),
            name: userData.name || userData.username,
            accessToken: apiKey
          }
        } catch (error) {
          throw createError({
            statusCode: 401,
            statusMessage: 'Invalid Dev.to API key'
          })
        }
        break
      }

      case 'wordpress': {
        // WordPress uses site URL, username, and application password
        const { siteUrl, username, applicationPassword } = credentials

        if (!siteUrl || !username || !applicationPassword) {
          throw createError({
            statusCode: 400,
            statusMessage: 'WordPress requires site URL, username, and application password'
          })
        }

        // Validate credentials by fetching user info
        try {
          const authHeader = Buffer.from(`${username}:${applicationPassword}`).toString('base64')
          const response = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
            headers: { 'Authorization': `Basic ${authHeader}` }
          })

          if (!response.ok) {
            throw new Error('Invalid credentials')
          }

          const userData = await response.json()
          accountInfo = {
            id: String(userData.id),
            name: userData.name || username,
            accessToken: applicationPassword
          }
        } catch (error) {
          throw createError({
            statusCode: 401,
            statusMessage: 'Invalid WordPress credentials'
          })
        }
        break
      }

      default:
        throw createError({
          statusCode: 400,
          statusMessage: `Platform ${platform} does not support API key authentication`
        })
    }

    if (!accountInfo) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to validate credentials'
      })
    }

    const account = await socialMediaAccountService.createOrUpdateAccount({
      id: accountInfo.id,
      picture: "",
      name: accountInfo.username,
      username: accountInfo.baseUrl,
      access_token: accountInfo.accessToken,
      user,
      businessId,
      platformId: platform
    })

    return {
      success: true,
      account
    }

  } catch (error) {
    console.error('Error handling API key authentication:', error)

    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: (error as any)?.statusMessage || 'Authentication failed'
    })
  }
})
