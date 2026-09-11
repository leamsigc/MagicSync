import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'List saved carousel decks, newest first. Returns summaries only — use get-carousel for full slide data.',
  inputSchema: {},
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler() {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const result = await carouselService.listForUser(userId)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to list carousels')
    }
    return {
      carousels: result.data.map(c => ({
        id: c.id,
        name: c.name,
        slideCount: c.slides.length,
        isPublic: c.isPublic ?? false,
        shareSlug: c.shareSlug,
        updatedAt: c.updatedAt,
      })),
    }
  },
})
