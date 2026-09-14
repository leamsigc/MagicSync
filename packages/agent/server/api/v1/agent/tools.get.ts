import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { AGENT_TOOL_CATALOG } from '#layers/BaseAgent/server/agent/tool-catalog'

export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  return { tools: AGENT_TOOL_CATALOG }
})
