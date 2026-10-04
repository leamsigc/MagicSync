import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Template ID is required' })
  const body = await readBody(event)
  const businessId = typeof body?.businessId === 'string' ? body.businessId : ''
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  if (!body?.theme) throw createError({ statusCode: 400, statusMessage: 'theme is required' })
  const result = await analyticsService.applyTemplate(user.id, businessId, id, body.theme, { useBusinessContext: body.useBusinessContext === true }, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})