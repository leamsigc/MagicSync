import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"
import z from 'zod'

const InputSchema = z.object({
  brief: z.string().optional(),
  useBusinessContext: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const runId = getRouterParam(event, 'runId')
    if (!runId) {
      throw createError({ statusCode: 400, statusMessage: 'runId is required' })
    }

    const body = await readValidatedBody(event, InputSchema.parse)
    log.set({ userId: user.id, runId })

    const result = await pipelineService.updateRunInput(runId, user.id, body, event)
    if (!result.success) {
      throw createError({
        statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
        statusMessage: result.error || 'Failed to update pipeline run input'
      })
    }

    log.info({ message: 'Pipeline run input updated', runId })
    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    log.error({ content: 'Update pipeline run input error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
