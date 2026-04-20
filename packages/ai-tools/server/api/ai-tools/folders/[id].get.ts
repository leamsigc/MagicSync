import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { folderService } from '#layers/BaseDB/server/services/folder.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Folder ID required' })
  }

  const result = await folderService.findById(id, user.id)

  if (result.error) {
    if (result.code === 'NOT_FOUND') {
      const globalResult = await folderService.findById(id, 'global')
      if (globalResult.data?.isGlobal) {
        return globalResult.data
      }
    }
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return result.data
})