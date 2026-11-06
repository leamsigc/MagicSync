import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' && query.businessId ? query.businessId : undefined
  const result = await autoReplyService.listCampaigns(user.id, businessId, event)
  if (result.error) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : 500, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})
