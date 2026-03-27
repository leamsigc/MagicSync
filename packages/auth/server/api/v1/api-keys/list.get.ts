import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const businessId = query.businessId as string

  if (!businessId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Business ID is required'
    })
  }

  const apiKeys = await apiKeyService.listApiKeys(businessId, user.id)

  return {
    apiKeys,
    total: apiKeys.length
  }
})
