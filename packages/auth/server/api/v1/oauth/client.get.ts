import { auth } from '#layers/BaseAuth/lib/auth'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useAuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'

/**
 * Public client info for the consent screen (name, uri, icon — never secrets).
 * Session-authenticated: only logged-in users consent.
 */
export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  const query = getQuery(event)
  const clientId = query.client_id as string
  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'client_id is required' })
  }

  try {
    const client = await auth.api.getOAuthClientPublic({
      query: { client_id: clientId },
      headers: useAuthApi(event).headers(),
    })
    return client
  }
  catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Unknown OAuth client',
    })
  }
})
