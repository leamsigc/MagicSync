import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  log.set({ folderId: id })

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Folder ID required' })
  }

  const result = await aiToolsFacade.updateFolder(id, user.id, {
    name: body.name,
    parentId: body.parentId,
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})