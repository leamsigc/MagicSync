import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'

const Schema = z.object({
  businessId: z.string().min(1),
  jobId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  const body = await readValidatedBody(event, Schema.parse)
  log.set({ businessId: body.businessId, jobId: body.jobId })
  const result = await destinationService.verifyGithub(user.id, { businessId: body.businessId, jobId: body.jobId }, event)
  if (!result.success) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }
  return result
})
