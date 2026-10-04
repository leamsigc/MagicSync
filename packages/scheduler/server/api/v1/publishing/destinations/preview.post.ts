import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'

const Schema = z.object({
  businessId: z.string().min(1),
  provider: z.enum(['github', 'wordpress']).default('github'),
  language: z.string().min(1),
  slug: z.string().min(1),
  repository: z.string().optional(),
  branch: z.string().optional(),
  targetPath: z.string().optional(),
  connectionId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  const body = await readValidatedBody(event, Schema.parse)
  log.set({ businessId: body.businessId })
  const result = await destinationService.previewGithub(user.id, {
    businessId: body.businessId,
    repository: body.repository,
    branch: body.branch,
    language: body.language,
    slug: body.slug,
    title: body.slug,
    brief: '',
    targetPath: body.targetPath,
    connectionId: body.connectionId,
  }, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : 400, statusMessage: result.error })
  }
  return result
})
