import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service'
import { ScheduleRefreshSocialMediaTokens } from '#layers/BaseScheduler/server/utils/ScheduleUtils'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { getMcpHeaders } from '../../utils/mcp-request'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Publish a pending post RIGHT NOW across its target platforms. For failed posts, resets and retries them. The scheduler remains the single publisher — this tool only makes the post due and triggers it (same path as the dashboard Publish button).',
  inputSchema: {
    postId: z.string().describe('ID of the pending (or failed) post to publish now'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const existing = await postService.findById(args.postId, userId, true)
      if (!existing.success || !existing.data) {
        throw new Error(existing.error || 'Post not found')
      }
      const post = existing.data as { businessId?: string, status?: string }
      if (post.businessId !== mcp.businessId) {
        throw new Error('Post not found')
      }

      if (post.status === 'published') {
        throw new Error('Post is already published')
      }

      if (post.status === 'failed') {
        const retried = await postService.retryFailedPost(args.postId, userId)
        if (!retried.success) {
          throw new Error(retried.error || 'Failed to retry post')
        }
      }
      else {
        // update() has no future-date validation, so setting scheduledAt=now is safe.
        const updated = await postService.update(args.postId, userId, { scheduledAt: new Date() })
        if (!updated.success) {
          throw new Error(updated.error || 'Failed to mark post due')
        }
      }

      const fullPost = await postService.findByIdFull({ postId: args.postId, userId })
      await ScheduleRefreshSocialMediaTokens(fullPost, userId, getMcpHeaders())
      new AutoPostService().triggerSocialMediaPost(fullPost)

      await logMcpCall(mcp, 'publish-now', args.postId)
      const statuses = (fullPost.platformPosts ?? []).map((pp: { socialAccountId: string, status: string }) => ({
        accountId: pp.socialAccountId,
        status: pp.status,
      }))
      return { postId: args.postId, triggered: true, platformStatuses: statuses }
    }
    catch (error) {
      await logMcpCall(mcp, 'publish-now', args.postId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
