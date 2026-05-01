import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { folderService } from '#layers/BaseDB/server/services/folder.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)

  log.info('Listing folders', {})

  const result = await folderService.findByUser(user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})