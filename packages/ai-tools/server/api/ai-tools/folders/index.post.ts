import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ folderName: body.name })

  if (!body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Folder name is required' })
  }

  const result = await aiToolsFacade.createFolder(user.id, {
    name: body.name,
    parentId: body.parentId,
    path: body.path,
    isGlobal: body.isGlobal,
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})