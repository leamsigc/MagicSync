import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')

  log.set({ documentId: id })

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  await aiToolsFacade.deleteChunksByDocument(id)

  const result = await aiToolsFacade.deleteDocument(id, user.id)

  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return { success: true, id }
})
