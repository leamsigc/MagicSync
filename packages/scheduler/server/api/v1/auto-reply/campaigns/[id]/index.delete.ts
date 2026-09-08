import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign id required' })
  const result = await autoReplyService.deleteCampaign(user.id, id)
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return { success: true }
})
