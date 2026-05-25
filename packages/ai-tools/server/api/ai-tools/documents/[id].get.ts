import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')

  log.set({ documentId: id })

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  const result = await aiToolsFacade.getDocument(id, user.id)

  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return result.data
})
