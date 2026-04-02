import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService } from '#layers/BaseDB/server/services/document.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  const body = await readBody(event)
  const { folderId } = body

  if (folderId !== null && typeof folderId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid folder ID' })
  }

  const result = await documentService.updateFolder(id, user.id, folderId)

  if (result.error) {
    throw createError({ statusCode: 400, statusMessage: result.error })
  }

  return result.data
})
