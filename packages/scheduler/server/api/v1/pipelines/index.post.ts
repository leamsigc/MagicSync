import { CreatePipelineSchema } from '#layers/BaseDB/db/schema'
import { pipelineService } from '#layers/BaseDB/server/services/pipeline.service'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  let body
  try {
    body = await readValidatedBody(event, CreatePipelineSchema.parse)
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

  const result = await pipelineService.createPipeline(user.id, body, event)

  if (!result.success) {
    log.error({ message: result.error || 'Failed to create pipeline' })
    throw createError({
      statusCode: 400,
      statusMessage: result.error || 'Failed to create pipeline'
    })
  }

  log.info({ message: 'Pipeline created', pipelineId: result.data.id })

  return result
})
