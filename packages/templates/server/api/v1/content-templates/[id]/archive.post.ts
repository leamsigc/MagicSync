import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Template ID is required' })
  const body = await readBody(event)
  const businessId = typeof body?.businessId === 'string' ? body.businessId : ''
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  const result = await analyticsService.archiveTemplate(user.id, id, businessId, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})