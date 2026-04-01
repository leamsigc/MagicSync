import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const result = await userLlmConfigService.getConfigs(user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
