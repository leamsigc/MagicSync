import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { agentSessionService } from '#layers/BaseAgent/server/services/agent-session.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Session id is required' })

  const session = await agentSessionService.getSession(user.id, id)
  if (!session.success) {
    throw createError({ statusCode: 404, statusMessage: session.error })
  }

  const entries = await agentSessionService.loadEntries(user.id, id)
  if (!entries.success) {
    throw createError({ statusCode: 500, statusMessage: entries.error })
  }

  return {
    session: session.data,
    entries: entries.data.map(row => ({ seq: row.seq, entry: row.entry })),
  }
})
