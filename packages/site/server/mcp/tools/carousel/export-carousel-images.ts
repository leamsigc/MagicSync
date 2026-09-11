import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { exportCarouselToDraft } from '#layers/BaseTools/server/utils/carousel-export'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp, requireScope, resolveAccounts } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Render a saved carousel deck to 1080×1350 PNGs server-side, store each as a media asset, and create a placeholder post (scheduled 24h out) carrying them. Always follow with update-post to set the final Claude-written caption and schedule. Decks must have 2–10 slides (Instagram bounds); edit the deck first otherwise.',
  inputSchema: {
    carouselId: z.string().describe('Carousel ID from create-carousel'),
    platforms: z.array(PLATFORMS).min(1).default(['instagram']).describe('Target platforms (must be connected to the business)'),
    caption: z.string().max(2000).optional().describe('Draft caption; defaults to the deck name. Finalize via update-post.'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const { accounts, userId } = await resolveAccounts(mcp, args.platforms)

    try {
      const result = await exportCarouselToDraft({
        userId,
        businessId: mcp.businessId,
        carouselId: args.carouselId,
        accountIds: accounts.map(a => a.id),
        caption: args.caption,
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to export carousel')
      }
      await logMcpCall(mcp, 'export-carousel-images', result.data.draftPostId)
      return { carouselId: args.carouselId, assetIds: result.data.assetIds, draftPostId: result.data.draftPostId, slideCount: result.data.slideCount, platforms: args.platforms }
    }
    catch (error) {
      await logMcpCall(mcp, 'export-carousel-images', args.carouselId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
