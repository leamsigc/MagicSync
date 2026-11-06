import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Publish/unpublish a design into the public template library. */
export default defineMcpTool({
  description: 'Publish one of your designs as a public template (isPublic=true) or unpublish it (false). All templates are free — publishing is for discovery, not paywalls.',
  inputSchema: {
    id: z.string().min(6).max(80),
    isPublic: z.boolean(),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const result = await designService.setPublic(args.id, userId, args.isPublic)
      if (!result.success || !result.data) {
        throw new Error(result.error === 'Design not found' ? 'Design not found (owner only)' : `Failed: ${result.error}`)
      }
      logMcpCall('publish-design-template', { userId, id: args.id, isPublic: args.isPublic })
      return { id: args.id, isPublic: result.data.isPublic }
    } catch (error) {
      log.error({ message: 'publish-design-template failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to publish design')
    }
  },
})
