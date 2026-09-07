import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp, resolveAccounts } from '../../utils/mcp-context'
import { assertValidForPlatforms } from '../../utils/mcp-validate'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Dry-run: render exactly what create-post would publish per platform (content after overrides, per-platform limit checks) WITHOUT writing anything. Advisory — call before publish-now to catch mistakes.',
  inputSchema: {
    content: z.string().min(1).max(2000).describe('Post text content'),
    platforms: z.array(PLATFORMS).min(1).describe('Target platforms'),
    mediaAssetIds: z.array(z.string()).optional().describe('Asset library IDs'),
    scheduledAt: z.string().datetime().optional().describe('Planned ISO datetime'),
    postFormat: z.enum(['post', 'reel', 'story', 'short']).default('post'),
    platformContent: z.record(z.string(), z.object({
      content: z.string(),
      comments: z.array(z.string()).optional(),
    })).optional().describe('Per-platform content overrides, keyed by platform name'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const { accounts } = await resolveAccounts(mcp, args.platforms)
    const validations = assertValidForPlatforms({
      platforms: args.platforms,
      content: args.content,
      platformContent: args.platformContent,
      imageCount: args.mediaAssetIds?.length ?? 0,
    })

    const preview = args.platforms.map(platform => ({
      platform,
      accountIds: accounts.filter(a => a.platform === platform).map(a => a.id),
      content: args.platformContent?.[platform]?.content ?? args.content,
      warnings: validations[platform]?.warnings ?? [],
    }))

    await logMcpCall(mcp, 'preview-post', undefined, 'success', `platforms=${args.platforms.join(',')}`)
    return {
      valid: true,
      writesNothing: true,
      wouldPublishAt: args.scheduledAt ?? 'immediately',
      postFormat: args.postFormat,
      mediaAssetCount: args.mediaAssetIds?.length ?? 0,
      preview,
    }
  },
})
