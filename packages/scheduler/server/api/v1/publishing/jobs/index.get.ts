import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { publishingService } from "#layers/BaseDB/server/services/publishing.service"

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  const result = await publishingService.listJobs(user.id, businessId, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})