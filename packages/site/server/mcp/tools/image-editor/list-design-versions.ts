import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Design version history (owner-only, latest 20). */
export default defineMcpTool({
  description: 'List saved versions of one of your designs (latest 20). Use restore-design-version to roll back.',
  inputSchema: {
    id: z.string().min(6).max(80).describe('Design id'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'read')
    const userId = await resolveUserId(mcp)

    try {
      const result = await designService.listVersions(args.id, userId)
      if (!result.success || !result.data) throw new Error(result.error ?? 'Failed to list versions')
      logMcpCall('list-design-versions', { userId, id: args.id })
      return { id: args.id, count: result.data.length, versions: result.data.map(row => ({ id: row.id, version: row.version, title: row.title, createdAt: row.createdAt })) }
    } catch (error) {
      log.error({ message: 'list-design-versions failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to list versions')
    }
  },
})
