import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { folderService } from '#layers/BaseDB/server/services/folder.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Folder ID required' })
  }

  const result = await folderService.update(id, user.id, {
    name: body.name,
    parentId: body.parentId,
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})