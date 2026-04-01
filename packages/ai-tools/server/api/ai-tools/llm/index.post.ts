import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.provider || !body?.model) {
    throw createError({ statusCode: 400, statusMessage: 'Provider and model are required' })
  }

  const result = await userLlmConfigService.createConfig(user.id, {
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey,
    apiBaseUrl: body.apiBaseUrl,
    isDefault: body.isDefault,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
