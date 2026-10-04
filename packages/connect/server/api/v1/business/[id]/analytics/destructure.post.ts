import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const businessId = getRouterParam(event, 'id')
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })
  const body = await readBody(event)
  if (!body?.postId) throw createError({ statusCode: 400, statusMessage: 'postId is required' })
  const result = await analyticsService.destructurePost(user.id, businessId, body.postId, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})