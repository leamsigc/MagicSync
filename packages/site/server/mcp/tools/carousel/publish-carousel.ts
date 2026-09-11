import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { appUrl } from '../../utils/carousel-shapes'

export default defineMcpTool({
  description: 'Publish a carousel to a public share link anyone with the URL can view (pixel-final preview before posting). Returns the share URL.',
  inputSchema: {
    carouselId: z.string().describe('Carousel ID to publish'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await carouselService.publish(userId, args.carouselId)
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to publish carousel')
      }
      await logMcpCall(mcp, 'publish-carousel', args.carouselId)
      return { carouselId: args.carouselId, slug: result.data.slug, shareUrl: `${appUrl()}/tools/carousel/shared/${result.data.slug}` }
    }
    catch (error) {
      await logMcpCall(mcp, 'publish-carousel', args.carouselId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
