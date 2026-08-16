import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const result = await businessProfileService.deleteRaw(id)
  if (!result.success) {
    throw createError({
      statusCode: result.code === '404' ? 404 : 500,
      message: result.error || 'Failed to delete business'
    })
  }

  return { message: 'Business deleted successfully' }
})
