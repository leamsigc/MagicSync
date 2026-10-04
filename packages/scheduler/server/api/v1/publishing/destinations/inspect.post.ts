import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'

const Schema = z.object({
  businessId: z.string().min(1),
  provider: z.enum(['github', 'wordpress']).default('github'),
  repository: z.string().min(1),
  branch: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  const body = await readValidatedBody(event, Schema.parse)
  log.set({ businessId: body.businessId, provider: body.provider })
  if (body.provider !== 'github') {
    throw createError({ statusCode: 400, statusMessage: 'Only github inspection is supported' })
  }
  const result = await destinationService.inspectGithub(user.id, { businessId: body.businessId, repository: body.repository, branch: body.branch }, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : 400, statusMessage: result.error })
  }
  log.info({ message: 'Destination inspected', repository: body.repository })
  return result
})
