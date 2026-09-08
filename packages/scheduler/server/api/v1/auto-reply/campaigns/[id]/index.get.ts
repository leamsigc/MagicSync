import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign id required' })
  const result = await autoReplyService.getCampaign(user.id, id)
  if (result.error) {
    const status = result.code === 'NOT_FOUND' ? 404 : 500
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})
