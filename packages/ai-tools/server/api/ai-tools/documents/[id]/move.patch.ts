import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')

  log.set({ documentId: id })

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  const body = await readBody(event)
  const { folderId } = body

  if (folderId !== null && typeof folderId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid folder ID' })
  }

  const result = await aiToolsFacade.updateDocumentFolder(id, user.id, folderId)

  if (result.error) {
    throw createError({ statusCode: 400, statusMessage: result.error })
  }

  return result.data
})
