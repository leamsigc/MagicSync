import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { oauthConsentService } from '#layers/BaseDB/server/services/oauth-consent.service'

/**
 * OAuth grants (authorized MCP connectors) for the logged-in user,
 * for the Connected Apps section of key management.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const result = await oauthConsentService.listForUser(user.id, {
    pagination: {
      page: Number(query.page) || 1,
      limit: Math.min(Number(query.limit) || 20, 50),
    },
  })
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return result
})
