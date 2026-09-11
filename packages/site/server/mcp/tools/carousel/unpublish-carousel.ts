import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Remove a carousel public share link. The private deck is kept.',
  inputSchema: {
    carouselId: z.string().describe('Carousel ID to unpublish'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await carouselService.unpublish(userId, args.carouselId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to unpublish carousel')
      }
      await logMcpCall(mcp, 'unpublish-carousel', args.carouselId)
      return { carouselId: args.carouselId, unpublished: true }
    }
    catch (error) {
      await logMcpCall(mcp, 'unpublish-carousel', args.carouselId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
