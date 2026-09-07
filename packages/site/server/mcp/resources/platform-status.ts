import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { requireMcp } from '../utils/mcp-context'

export default defineMcpResource({
  description: 'Connected platforms + token health for the key-bound business.',
  uri: 'magic-sync://platforms/status',
  enabled: event => !!event.context.mcp?.valid,
  async handler(uri: URL) {
    const mcp = requireMcp()

    const accounts = await socialMediaAccountService.getBusinessTokenHealth(mcp.businessId)

    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          businessId: mcp.businessId,
          accounts: accounts.map(a => ({
            id: a.id,
            platform: a.platform,
            accountName: a.accountName,
            isActive: a.isActive,
            health: a.health.status,
            daysRemaining: a.health.daysRemaining,
          })),
        }),
      }],
    }
  },
})
