import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { SchedulerPost } from "#layers/BaseScheduler/server/services/SchedulerPost.service"
import { getPluginForPlatform } from "#layers/BaseScheduler/server/utils/pluginLoader"

export default defineEventHandler(async (event) => {
  const BASE_URL = process.env.NUXT_BASE_URL

  try {
    const platform = getRouterParam(event, 'platform') as string
    const query = getQuery(event)
    const user = await checkUserIsLogin(event)

    const state = getCookie(event, `${platform}_oauth_state`)
    const codeVerifier = getCookie(event, `${platform}_oauth_code_verifier`)

    const pluginClass = getPluginForPlatform(platform)
    if (!pluginClass) {
      throw new Error(`Platform ${platform} not supported by scheduler`)
    }

    const scheduler = new SchedulerPost({})
    scheduler.use(pluginClass)

    await scheduler.handleCallback(platform, query, user, state, codeVerifier)

    // Clear cookies
    deleteCookie(event, `${platform}_oauth_state`)
    deleteCookie(event, `${platform}_oauth_code_verifier`)

    const baseUrl = BASE_URL || 'http://localhost:3000'
    return sendRedirect(event, `${baseUrl}/app/integrations`)

  } catch (error) {
    console.error('Error handling OAuth callback:', error)

    const baseUrl = BASE_URL || 'http://localhost:3000'
    const errorMessage = error instanceof Error
      ? error.message
      : (error as any)?.statusMessage || 'Connection failed'
    const errorUrl = `${baseUrl}/app/integrations?error=${encodeURIComponent(errorMessage)}`

    return sendRedirect(event, errorUrl)
  }
})
