import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { publishingService } from "#layers/BaseDB/server/services/publishing.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)

    const query = getQuery(event)
    const businessId = query.businessId as string
    if (!businessId) {
      log.set({ validationError: true, message: 'Business ID is required' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    log.set({ businessId, userId: user.id })
    const result = await publishingService.listConnections(user.id, businessId, event)

    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'List publishing connections error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
