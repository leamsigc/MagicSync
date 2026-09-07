import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { inboxService } from '#layers/BaseScheduler/server/services/Inbox.service'
import { z } from 'zod'
import { getQuery } from 'h3'

const QuerySchema = z.object({
  platform: z.string().optional(),
  type: z.enum(['comment', 'dm', 'notification']).optional(),
  postId: z.string().optional(),
  read: z.coerce.boolean().optional(),
  archived: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const query = getQuery(event)
    const parsed = QuerySchema.parse(query)

    const result = await inboxService.getUnifiedInbox({
      userId: user.id,
      ...parsed,
    })

    return { success: true, data: result }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    log.error({ content: 'Get inbox error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
