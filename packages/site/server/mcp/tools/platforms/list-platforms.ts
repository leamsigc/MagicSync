import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { requireMcp } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'List social accounts connected to the business bound to your API key. Returns safe fields only — never tokens. Use the account IDs with resolveAccounts-backed tools.',
  inputSchema: {},
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler() {
    const mcp = requireMcp()

    const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(mcp.businessId)

    return {
      businessId: mcp.businessId,
      accounts: accounts.map(a => ({
        id: a.id,
        platform: a.platform,
        accountName: a.accountName,
        accountId: a.accountId,
        isActive: a.isActive,
      })),
    }
  },
})
