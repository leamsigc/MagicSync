import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''

  if (!businessId) {
    throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  }

  const result = await aiToolsFacade.clearLlmOverride(user.id, businessId)
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return { success: true }
})
