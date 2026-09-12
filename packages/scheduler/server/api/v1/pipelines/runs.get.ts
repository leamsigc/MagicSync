import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)

    const query = getQuery(event)
    const businessId = query.businessId as string | undefined

    if (!businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'businessId query param is required'
      })
    }

    log.set({ userId: user.id, businessId })
    const result = await pipelineService.listRuns(user.id, businessId, event)

    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'List pipeline runs error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
