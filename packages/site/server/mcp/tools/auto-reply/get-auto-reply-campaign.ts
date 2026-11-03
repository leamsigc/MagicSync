import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'
import { campaignSummary, requireCampaign } from '../../utils/auto-reply-scope'

export default defineMcpTool({
  description: 'Read one auto-reply campaign with its settings, delivery stats (sent/skipped/failed, clicks per link) and the most recent log rows.',
  inputSchema: {
    campaignId: z.string().min(1).describe('Campaign id from list-auto-reply-campaigns'),
    logLimit: z.number().int().min(0).max(100).default(20).describe('How many recent log rows to include'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const campaign = await requireCampaign(mcp, userId, args.campaignId)

    const stats = await autoReplyService.getStats(userId, campaign.id)
    if (!stats.success) throw new Error(stats.error || 'Failed to read campaign stats')
    const logs = args.logLimit > 0
      ? await autoReplyService.getLogs(userId, campaign.id, args.logLimit)
      : null

    return {
      businessId: mcp.businessId,
      campaign: campaignSummary(campaign),
      stats: stats.data,
      logs: logs?.success ? logs.data : [],
    }
  },
})
