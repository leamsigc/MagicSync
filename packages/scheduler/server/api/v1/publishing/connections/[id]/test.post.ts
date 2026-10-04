import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { publishingService } from "#layers/BaseDB/server/services/publishing.service"

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Connection ID is required' })
  const result = await publishingService.testConnection(user.id, id, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})