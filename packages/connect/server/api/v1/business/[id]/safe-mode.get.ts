import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })

  const access = await businessProfileService.findById(id, user.id)
  if (!access.success || !access.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' })
  }

  const result = await businessProfileService.getSafeMode(id, event)
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error })
  return { safeMode: result.data }
})
