import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Permanently delete a carousel deck and its public share link. Cannot be undone. Draft posts already created from it keep their images.',
  inputSchema: {
    carouselId: z.string().describe('Carousel ID to delete'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await carouselService.remove(userId, args.carouselId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete carousel (it may not exist or belong to another user)')
      }
      await logMcpCall(mcp, 'delete-carousel', args.carouselId)
      return { carouselId: args.carouselId, deleted: true }
    }
    catch (error) {
      await logMcpCall(mcp, 'delete-carousel', args.carouselId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
