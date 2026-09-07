import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { inboxService } from '#layers/BaseScheduler/server/services/Inbox.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const count = await inboxService.getUnreadCount(user.id)
    return { success: true, data: { count } }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    log.error({ content: 'Get inbox count error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
