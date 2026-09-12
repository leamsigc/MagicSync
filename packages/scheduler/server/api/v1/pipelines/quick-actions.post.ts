import { QuickActionRequestSchema } from '#layers/BaseDB/db/schema'
import { pipelineService } from '#layers/BaseDB/server/services/pipeline.service'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  let body
  try {
    body = await readValidatedBody(event, QuickActionRequestSchema.parse)
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

  log.set({ businessId: body.businessId, action: body.action })
  const result = body.action === 'repurpose'
    ? await pipelineService.repurposePost(user.id, body, event)
    : await pipelineService.queueQuickAction(user.id, body, event)

  if (!result.success) {
    log.error({ message: result.error || 'Failed to queue quick action', action: body.action })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
      statusMessage: result.error || 'Failed to queue quick action'
    })
  }

  log.info({ message: 'Quick action queued', action: body.action })

  return result
})
