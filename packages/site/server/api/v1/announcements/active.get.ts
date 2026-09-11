import { announcementService } from '#layers/BaseDB/server/services/announcement.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)

  const result = await announcementService.getActive()
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
