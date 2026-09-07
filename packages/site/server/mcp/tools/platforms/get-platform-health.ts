import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { requireMcp } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'Check OAuth token health for every connected account: healthy, expiring_soon, expired, or unknown, with days remaining. If an account is expired, tell the user to reconnect it in the MagicSync dashboard — agents cannot complete OAuth.',
  inputSchema: {},
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler() {
    const mcp = requireMcp()

    const accounts = await socialMediaAccountService.getBusinessTokenHealth(mcp.businessId)

    return {
      businessId: mcp.businessId,
      accounts: accounts.map(a => ({
        id: a.id,
        platform: a.platform,
        accountName: a.accountName,
        health: a.health.status,
        expiresAt: a.health.expiresAt instanceof Date ? a.health.expiresAt.toISOString() : a.health.expiresAt,
        daysRemaining: a.health.daysRemaining,
      })),
    }
  },
})
