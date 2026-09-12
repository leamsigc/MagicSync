import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const runId = getRouterParam(event, 'runId')
    if (!runId) {
      throw createError({ statusCode: 400, statusMessage: 'runId is required' })
    }

    log.set({ userId: user.id, runId })
    const result = await pipelineService.resumeRun(runId, user.id, event)
    if (!result.success) {
      throw createError({
        statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
        statusMessage: result.error || 'Failed to resume pipeline run'
      })
    }

    log.info({ message: 'Pipeline run resumed', runId })
    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    log.error({ content: 'Resume pipeline run error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
