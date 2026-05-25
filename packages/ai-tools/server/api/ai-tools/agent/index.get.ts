import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const query = getQuery(event)

  log.set({ parentMessageId: query.parent_message_id })
  const parentMessageId = query.parent_message_id as string | undefined

  const result = await aiToolsFacade.listAgentSessions(user.id, parentMessageId)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return { agents: result.data || [] }
})
