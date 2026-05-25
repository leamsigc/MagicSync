import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const threadId = getRouterParam(event, 'id')

  log.set({ threadId })

  if (!threadId) {
    throw createError({ statusCode: 400, statusMessage: 'Thread ID required' })
  }

  const result = await aiToolsFacade.getMessages(threadId, user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
