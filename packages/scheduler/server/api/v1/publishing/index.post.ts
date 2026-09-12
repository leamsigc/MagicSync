import { CreatePublishConnectionSchema } from '#layers/BaseDB/db/schema'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  let body
  try {
    body = await readValidatedBody(event, CreatePublishConnectionSchema.parse)
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

  const result = await publishingService.createConnection(user.id, body, event)

  if (!result.success) {
    log.error({ message: result.error || 'Failed to create publishing connection' })
    throw createError({
      statusCode: 400,
      statusMessage: result.error || 'Failed to create publishing connection'
    })
  }

  log.info({ message: 'Publishing connection created', connectionId: result.data.id })

  return result
})
