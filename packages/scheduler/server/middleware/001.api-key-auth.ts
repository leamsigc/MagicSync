import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'

export default defineEventHandler(async (event) => {
  const path = event.path
  
  if (!path.startsWith('/api/v1/cli/')) {
    return
  }

  const apiKey = getHeader(event, 'x-api-key')
  
  const result = await apiKeyService.verifyApiKey(apiKey || '')

  if (!result.success || !result.context) {
    throw createError({
      statusCode: result.error?.statusCode || 401,
      statusMessage: result.error?.message || 'API key verification failed'
    })
  }

  event.context.apiKey = result.context
})
