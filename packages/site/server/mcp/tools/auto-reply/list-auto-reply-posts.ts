import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'
import { autoReplyAccounts } from '../../utils/auto-reply-scope'

export default defineMcpTool({
  description: 'List posts published through MagicSync on one of the business\'s Instagram accounts, so a campaign can watch specific posts instead of every post.',
  inputSchema: {
    socialAccountId: z.string().min(1).describe('Instagram account row id from list-auto-reply-accounts'),
    limit: z.number().int().min(1).max(20).default(10).describe('How many posts to return'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const { ids } = await autoReplyAccounts(mcp)
    if (!ids.has(args.socialAccountId)) {
      throw new Error('socialAccountId is not an Instagram account connected to this business.')
    }

    const result = await autoReplyService.listPublishedPosts(userId, args.socialAccountId, args.limit)
    if (!result.success) throw new Error(result.error || 'Failed to list posts')
    return {
      socialAccountId: args.socialAccountId,
      posts: result.data ?? [],
    }
  },
})
