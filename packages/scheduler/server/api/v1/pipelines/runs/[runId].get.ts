import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)

    const runId = getRouterParam(event, 'runId')
    if (!runId) {
      log.set({ validationError: true, message: 'Run ID is required' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Run ID is required'
      })
    }

    log.set({ runId, userId: user.id })
    const result = await pipelineService.getRun(runId, user.id, event)

    if (!result.success) {
      throw createError({
        statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
        statusMessage: result.error || 'Pipeline run not found'
      })
    }

    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'Get pipeline run error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
