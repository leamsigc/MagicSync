import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const businessId = getRouterParam(event, 'id')
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })
  const query = getQuery(event)
  const days = Number(query.days ?? 30)
  const platform = typeof query.platform === 'string' ? query.platform : undefined
  const limit = Number(query.limit ?? 5)
  const result = await analyticsService.getBestPosts(user.id, businessId, { days, platform, limit }, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})