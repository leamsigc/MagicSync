import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'

const Schema = z.object({
  businessId: z.string().min(1),
  artifactId: z.string().min(1),
  connectionId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  const body = await readValidatedBody(event, Schema.parse)
  log.set({ businessId: body.businessId, artifactId: body.artifactId })
  const result = await destinationService.publishGithub(user.id, { businessId: body.businessId, artifactId: body.artifactId, connectionId: body.connectionId }, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : 400, statusMessage: result.error })
  }
  log.info({ message: 'Destination publish executed', jobId: result.data.jobId })
  return result
})
