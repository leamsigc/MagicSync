import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import type { UpdatePostData } from '#layers/BaseDB/server/services/post.service'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp, requireScope, resolveAccounts, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Update a pending post: edit content, swap media, retarget platforms, or reschedule. Published posts cannot be edited — create a new one instead.',
  inputSchema: {
    postId: z.string().describe('ID of the post to update'),
    content: z.string().min(1).max(2000).optional().describe('New post text'),
    platforms: z.array(PLATFORMS).min(1).optional().describe('New target platforms (replaces existing targeting)'),
    mediaAssetIds: z.array(z.string()).optional().describe('New asset library IDs (replaces existing media)'),
    scheduledAt: z.string().datetime().optional().describe('New ISO datetime (reschedules the post)'),
    postFormat: z.enum(['post', 'reel', 'story', 'short']).optional(),
    platformContent: z.record(z.string(), z.object({
      content: z.string(),
      comments: z.array(z.string()).optional(),
    })).optional().describe('Per-platform content overrides, keyed by platform name'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    const data: UpdatePostData = {}
    if (args.content !== undefined) data.content = args.content
    if (args.mediaAssetIds !== undefined) data.mediaAssets = args.mediaAssetIds
    if (args.scheduledAt !== undefined) data.scheduledAt = new Date(args.scheduledAt)
    if (args.postFormat !== undefined) data.postFormat = args.postFormat
    if (args.platformContent !== undefined) data.platformContent = args.platformContent
    if (args.platforms !== undefined) {
      const { accounts } = await resolveAccounts(mcp, args.platforms)
      data.targetPlatforms = accounts.map(a => a.id)
    }
    if (Object.keys(data).length === 0) {
      throw new Error('Nothing to update — provide at least one field besides postId')
    }

    try {
      const result = await postService.update(args.postId, userId, data)
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update post (it may be published, failed, or owned by another user)')
      }
      await logMcpCall(mcp, 'update-post', args.postId)
      const post = result.data
      return {
        postId: post.id,
        status: post.status,
        scheduledAt: post.scheduledAt instanceof Date ? post.scheduledAt.toISOString() : post.scheduledAt,
      }
    }
    catch (error) {
      await logMcpCall(mcp, 'update-post', args.postId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
