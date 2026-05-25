import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ title: body.title })

  if (!body?.title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' })
  }

  const result = await aiToolsFacade.createThread(user.id, { title: body.title })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
