import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { inboxService } from '#layers/BaseScheduler/server/services/Inbox.service'
import { readValidatedBody } from 'h3'
import { z } from 'zod'

const BodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const body = await readValidatedBody(event, BodySchema.parse)
    const updated = await inboxService.archiveItems(user.id, body.ids)
    return { success: true, data: { updated } }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    log.error({ content: 'Archive inbox error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
