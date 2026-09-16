import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })
  }
  log.set({ businessId: id })

  const result = await businessProfileService.getDeletePreview(id, user.id)
  if (!result.success || !result.data) {
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
      statusMessage: result.error
    })
  }
  return result.data
})
