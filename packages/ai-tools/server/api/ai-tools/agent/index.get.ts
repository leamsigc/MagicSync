import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { agentService } from '#layers/BaseDB/server/services/agent.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)

  log.set({ parentMessageId: query.parent_message_id })
  const parentMessageId = query.parent_message_id as string | undefined

  const result = await agentService.listByUser(user.id, parentMessageId)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return { agents: result.data || [] }
})
