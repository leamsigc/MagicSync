import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)

    const query = getQuery(event)
    const pipelineRunId = query.pipelineRunId as string | undefined
    const businessId = query.businessId as string | undefined
    const status = query.status as string | undefined
    const rawLimit = parseInt(query.limit as string)
    const limit = Number.isNaN(rawLimit) ? 20 : rawLimit

    log.set({ userId: user.id, pipelineRunId, limit })
    const result = await pipelineService.listAgentRuns(user.id, { pipelineRunId, businessId, status, limit }, event)

    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'List agent runs error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
