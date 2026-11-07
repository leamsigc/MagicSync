import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'
import { autoReplyAccounts, campaignSummary } from '../../utils/auto-reply-scope'

export default defineMcpTool({
  description: 'List the auto-reply (comment-to-DM) campaigns of the business bound to your API key, active and inactive. Use get-auto-reply-campaign for stats and logs.',
  inputSchema: {
    status: z.enum(['all', 'active', 'inactive']).default('all').describe('Filter by enabled state'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const { ids } = await autoReplyAccounts(mcp)
    const result = await autoReplyService.listCampaigns(userId, mcp.businessId)
    if (!result.success) throw new Error(result.error || 'Failed to list auto-reply campaigns')

    const owned = (result.data ?? []).filter(campaign => ids.has(campaign.socialAccountId))
    const campaigns = owned.filter(campaign => args.status === 'all'
      || (args.status === 'active' ? campaign.enabled : !campaign.enabled))

    return {
      businessId: mcp.businessId,
      status: args.status,
      counts: {
        all: owned.length,
        active: owned.filter(campaign => campaign.enabled).length,
        inactive: owned.filter(campaign => !campaign.enabled).length,
      },
      campaigns: campaigns.map(campaignSummary),
    }
  },
})
