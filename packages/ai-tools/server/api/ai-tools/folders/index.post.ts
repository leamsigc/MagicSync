import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { folderService } from '#layers/BaseDB/server/services/folder.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Folder name is required' })
  }

  const result = await folderService.create(user.id, {
    name: body.name,
    parentId: body.parentId,
    path: body.path || `/${body.name}`,
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})