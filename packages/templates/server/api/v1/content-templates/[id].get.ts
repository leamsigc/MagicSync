import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Template ID is required' })
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  const templates = await analyticsService.listTemplates(user.id, businessId, event)
  if (!templates.success || !templates.data) throw createError({ statusCode: 502, statusMessage: templates.error })
  const template = templates.data.find(row => row.id === id)
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  return { data: template }
})