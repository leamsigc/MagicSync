import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { postService } from '#layers/BaseDB/server/services/post.service'
import type { PostCreateBase } from '#layers/BaseDB/db/schema'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp, requireScope, resolveAccounts } from '../../utils/mcp-context'
import { assertValidForPlatforms } from '../../utils/mcp-validate'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Create a social media post on the business bound to your API key. Omit scheduledAt to publish as soon as possible, or set a future ISO datetime to schedule it.',
  inputSchema: {
    content: z.string().min(1).max(2000).describe('Post text content'),
    platforms: z.array(PLATFORMS).min(1).describe('Target platforms (must be connected to the business)'),
    mediaAssetIds: z.array(z.string()).optional().describe('Asset library IDs — use list-media first, never raw URLs'),
    scheduledAt: z.string().datetime().optional().describe('Future ISO datetime to schedule; omit for immediate publishing'),
    postFormat: z.enum(['post', 'reel', 'story', 'short']).default('post'),
    platformContent: z.record(z.string(), z.object({
      content: z.string(),
      comments: z.array(z.string()).optional(),
    })).optional().describe('Per-platform content overrides, keyed by platform name'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const { accounts, userId } = await resolveAccounts(mcp, args.platforms)
    assertValidForPlatforms({
      platforms: args.platforms,
      content: args.content,
      platformContent: args.platformContent,
      imageCount: args.mediaAssetIds?.length ?? 0,
    })

    const scheduledAt = args.scheduledAt ? new Date(args.scheduledAt) : new Date()
    try {
      const result = await postService.create(userId, {
        businessId: mcp.businessId,
        content: args.content,
        targetPlatforms: accounts.map(a => a.id),
        mediaAssets: args.mediaAssetIds ?? [],
        scheduledAt,
        // Service coerces status to 'pending' on write; a non-'pending' label bypasses
        // the future-scheduledAt validation for immediate posts (precedent: cli/post.post.ts).
        status: (scheduledAt > new Date() ? 'pending' : 'draft') as PostCreateBase['status'],
        comment: [],
        platformContent: args.platformContent,
        postFormat: args.postFormat,
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create post')
      }
      await logMcpCall(mcp, 'create-post', result.data.id)
      const post = result.data
      return {
        postId: post.id,
        status: post.status,
        scheduledAt: post.scheduledAt instanceof Date ? post.scheduledAt.toISOString() : post.scheduledAt,
        platforms: args.platforms,
      }
    }
    catch (error) {
      await logMcpCall(mcp, 'create-post', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
