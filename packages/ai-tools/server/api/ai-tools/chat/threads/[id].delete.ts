import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const threadId = getRouterParam(event, 'id')

  if (!threadId) {
    throw createError({ statusCode: 400, statusMessage: 'Thread ID required' })
  }

  const result = await chatService.deleteThread(threadId, user.id)

  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return { success: true, id: threadId }
})
