import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'
import { appUrl } from '../../utils/carousel-shapes'

export default defineMcpTool({
  description: 'Get a full carousel deck: every slide with templateKey + copy, palette, and the public share URL when published.',
  inputSchema: {
    carouselId: z.string().describe('Carousel ID from create-carousel or list-carousels'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const result = await carouselService.getForUser(userId, args.carouselId)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Carousel not found')
    }
    const deck = result.data
    return {
      id: deck.id,
      name: deck.name,
      slides: deck.slides,
      palette: deck.palette,
      pattern: deck.pattern,
      handle: deck.handle,
      isPublic: deck.isPublic ?? false,
      shareUrl: deck.shareSlug ? `${appUrl()}/tools/carousel/shared/${deck.shareSlug}` : null,
      updatedAt: deck.updatedAt,
    }
  },
})
