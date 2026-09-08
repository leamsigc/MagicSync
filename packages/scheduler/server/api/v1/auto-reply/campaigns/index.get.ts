import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const result = await autoReplyService.listCampaigns(user.id)
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})
