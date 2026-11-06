import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { prepareDesignDocument } from '#layers/BaseTools/shared/image-editor/fields'
import { isDocument } from '#layers/BaseTools/shared/image-editor/resolve-rows'
import type { ImageEditorDocument } from '#layers/BaseTools/shared/image-editor/document'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** List the caller's designs (thin page wrapper over the design service). */
export default defineMcpTool({
  description: 'List your saved image-editor designs ("My Designs"). Pair with get-design-template to inspect or render one.',
  inputSchema: {
    q: z.string().max(80).optional().describe('Filter by title'),
    limit: z.number().int().min(1).max(50).default(20),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'read')
    const userId = await resolveUserId(mcp)

    try {
      const result = await designService.list(userId, { q: args.q }, { page: 1, limit: args.limit })
      if (!result.success) throw new Error(result.error ?? 'Failed to list designs')
      logMcpCall('list-designs', { userId, count: result.data.length })
      return {
        count: result.data.length,
        designs: result.data.map((row) => {
          const doc = row.envelope.doc as ImageEditorDocument | null
          const prepared = isDocument(doc) ? prepareDesignDocument(doc) : null
          return {
            id: row.id,
            title: row.title,
            isPublic: row.isPublic,
            updatedAt: row.updatedAt,
            fields: prepared?.fields.map(field => field.name) ?? [],
          }
        }),
      }
    } catch (error) {
      log.error({ message: 'list-designs failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to list designs')
    }
  },
})
