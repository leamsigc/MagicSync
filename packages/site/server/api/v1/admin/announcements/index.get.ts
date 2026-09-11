import { announcementService } from '#layers/BaseDB/server/services/announcement.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const result = await announcementService.listAll()
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return { announcements: result.data }
})
