import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { publishingService } from "#layers/BaseDB/server/services/publishing.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
      log.set({ validationError: true, message: 'Connection ID is required' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Connection ID is required'
      })
    }

    log.set({ connectionId: id, userId: user.id })
    const result = await publishingService.deleteConnection(id, user.id, event)

    if (!result.success) {
      throw createError({
        statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
        statusMessage: result.error || 'Failed to delete publishing connection'
      })
    }

    log.set({ success: true })
    return {
      success: true,
      message: 'Publishing connection deleted successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'Delete publishing connection error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
