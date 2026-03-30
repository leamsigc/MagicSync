import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService, chunkService } from '#layers/BaseDB/server/services/document.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  // Delete chunks first
  await chunkService.deleteByDocument(id)

  // Delete document
  const result = await documentService.delete(id, user.id)

  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return { success: true, id }
})
