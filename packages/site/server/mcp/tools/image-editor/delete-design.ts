import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Delete one of the caller's designs. */
export default defineMcpTool({
  description: 'Delete an image-editor design you own. Verify with list-designs before calling.',
  inputSchema: {
    id: z.string().min(6).max(80).describe('Design id'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await designService.delete(args.id, userId)
      if (!result.success) throw new Error(result.error === 'Design not found' ? 'Design not found' : `Delete failed: ${result.error}`)
      logMcpCall('delete-design', { userId, id: args.id })
      return { id: args.id, deleted: true }
    } catch (error) {
      log.error({ message: 'delete-design failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to delete design')
    }
  },
})
