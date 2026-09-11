import { announcementService } from '#layers/BaseDB/server/services/announcement.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Announcement ID is required' })
  }

  const result = await announcementService.remove(id)
  if (result.error) {
    throw createError({ statusCode: 500, message: result.error })
  }

  return { success: true }
})
