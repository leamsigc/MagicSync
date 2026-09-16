import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { AGENT_TOOL_CATALOG } from '#layers/BaseAgent/server/agent/tool-catalog'

/**
 * Legacy catalog endpoint, kept for backwards compatibility.
 * Prefer `GET /api/v1/agent/capabilities?businessId=…`, which embeds this
 * same catalog alongside agents, bundled/registered skills, and the goal
 * layer — the chat UI's only discovery call.
 */
export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  return { tools: AGENT_TOOL_CATALOG }
})
