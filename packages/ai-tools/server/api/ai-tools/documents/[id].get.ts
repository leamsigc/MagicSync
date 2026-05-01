import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService } from '#layers/BaseDB/server/services/document.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  log.set({ documentId: id })

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  const result = await documentService.findById(id, user.id)

  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return result.data
})
