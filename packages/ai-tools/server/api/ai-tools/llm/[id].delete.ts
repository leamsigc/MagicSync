import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const configId = getRouterParam(event, 'id')

  if (!configId) {
    throw createError({ statusCode: 400, statusMessage: 'Config ID is required' })
  }

  const result = await userLlmConfigService.deleteConfig(user.id, configId)

  if (result.error) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : 500
    throw createError({ statusCode, statusMessage: result.error })
  }

  return { success: true }
})
