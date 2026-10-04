import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { createFlueAgentHandler } from '#layers/BaseAgent/server/flue/http'
import { MagicSyncAgent } from '#layers/BaseAgent/server/flue/magicsync-agent'

export default createFlueAgentHandler({
  agent: MagicSyncAgent,
  basePath: '/api/v1/agent/flue',
  resolveNamespace: async (event) => (await checkUserIsLogin(event)).id,
})
