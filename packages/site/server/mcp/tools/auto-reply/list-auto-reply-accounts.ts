import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { requireMcp } from '../../utils/mcp-context'
import { autoReplyAccounts } from '../../utils/auto-reply-scope'

export default defineMcpTool({
  description: 'List the social accounts connected to the business bound to your API key, flagging which Instagram accounts can host an auto-reply campaign. Safe fields only — never tokens.',
  inputSchema: {},
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler() {
    const mcp = requireMcp()
    const { all, instagram } = await autoReplyAccounts(mcp)
    const autoReplyIds = new Set(instagram.map(account => account.id))
    return {
      businessId: mcp.businessId,
      accounts: all.map(account => ({
        id: account.id,
        platform: account.platform,
        accountName: account.accountName,
        accountId: account.accountId,
        isActive: account.isActive,
        supportsAutoReply: autoReplyIds.has(account.id),
      })),
    }
  },
})
