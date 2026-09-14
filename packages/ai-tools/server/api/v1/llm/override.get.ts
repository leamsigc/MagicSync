import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''

  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })

  const result = await userLlmConfigService.getOverride(user.id, businessId)
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error })
  if (!result.data) return null

  const { apiKey, ...rest } = result.data
  return { ...rest, apiKey: null, hasKey: Boolean(apiKey) }
})
