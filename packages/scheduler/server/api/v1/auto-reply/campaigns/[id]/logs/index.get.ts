import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { z } from 'zod'

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(25),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign id required' })
  const parsed = querySchema.parse(getQuery(event))
  const result = await autoReplyService.getLogs(user.id, id, parsed.limit)
  if (result.error) {
    const status = result.code === 'NOT_FOUND' ? 404 : 500
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})
