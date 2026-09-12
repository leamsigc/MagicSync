import { UpdatePipelineSchema } from '#layers/BaseDB/db/schema'
import { pipelineService } from '#layers/BaseDB/server/services/pipeline.service'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Pipeline ID is required'
    })
  }

  log.set({ pipelineId: id })

  let body
  try {
    body = await readValidatedBody(event, UpdatePipelineSchema.parse)
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

  const result = await pipelineService.updatePipeline(id, user.id, body, event)

  if (!result.success) {
    log.error({ message: result.error || 'Pipeline not found or user not authorized', pipelineId: id })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
      statusMessage: result.error || 'Pipeline not found or user not authorized to update it'
    })
  }

  log.info({ message: 'Pipeline updated', pipelineId: id })

  return result
})
