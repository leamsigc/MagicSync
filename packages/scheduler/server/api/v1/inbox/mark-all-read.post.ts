import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { inboxService } from '#layers/BaseScheduler/server/services/Inbox.service'
import { readValidatedBody } from 'h3'
import { z } from 'zod'

const BodySchema = z.object({
  platform: z.string().optional(),
  type: z.enum(['comment', 'dm', 'notification']).optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const body = await readValidatedBody(event, BodySchema.parse)
    const updated = await inboxService.markAllAsRead(user.id, body)
    return { success: true, data: { updated } }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    log.error({ content: 'Mark all inbox read error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
