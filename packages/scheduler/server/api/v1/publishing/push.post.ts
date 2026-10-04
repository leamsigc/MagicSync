import { PushContentRequestSchema } from '#layers/BaseDB/db/schema'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  let body
  try {
    body = await readValidatedBody(event, PushContentRequestSchema.parse)
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors = e.issues.map((err: { path: any[]; message: any }) => ({
        field: err.path.join('.'),
        message: err.message
      }))
      log.error({ message: 'Validation error', errors: fieldErrors })
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Error',
        data: {
          name: 'ValidationError',
          message: 'Invalid request data',
          errors: fieldErrors
        }
      })
    }
    throw e
  }

  log.set({ businessId: body.businessId, provider: body.provider })
  const result = await publishingService.pushContent(user.id, body, event)

  if (!result.success) {
    log.error({ message: result.error || 'Failed to push content', provider: body.provider })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
      statusMessage: result.error || 'Failed to push content'
    })
  }

  log.info({ message: 'Content pushed', provider: body.provider })

  return result
})
