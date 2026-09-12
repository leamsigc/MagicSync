import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
      log.set({ validationError: true, message: 'Pipeline ID is required' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Pipeline ID is required'
      })
    }

    log.set({ pipelineId: id, userId: user.id })
    const result = await pipelineService.getPipeline(id, user.id, event)

    if (!result.success) {
      throw createError({
        statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
        statusMessage: result.error || 'Pipeline not found'
      })
    }

    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'Get pipeline error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
