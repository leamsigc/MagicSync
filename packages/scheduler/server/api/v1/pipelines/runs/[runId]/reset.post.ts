import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"
import z from 'zod'

const ResetSchema = z.object({
  step: z.number().int().min(0),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const runId = getRouterParam(event, 'runId')
    if (!runId) {
      throw createError({ statusCode: 400, statusMessage: 'runId is required' })
    }

    const body = await readValidatedBody(event, ResetSchema.parse)
    log.set({ userId: user.id, runId, step: body.step })

    const result = await pipelineService.resetToStep(runId, user.id, body.step, event)
    if (!result.success) {
      throw createError({
        statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
        statusMessage: result.error || 'Failed to reset pipeline run'
      })
    }

    log.info({ message: 'Pipeline run reset', runId, step: body.step })
    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    log.error({ content: 'Reset pipeline run error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
