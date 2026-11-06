import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { prepareDesignDocument } from '#layers/BaseTools/shared/image-editor/fields'
import { isDocument } from '#layers/BaseTools/shared/image-editor/resolve-rows'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Fetch one design/template's full document + variable fields. */
export default defineMcpTool({
  description: 'Fetch a design template by id: the full image-editor document (pages/objects), plus fields[] — the dynamic variable names you can fill via render-design or batch-generate-designs.',
  inputSchema: {
    id: z.string().min(6).max(80).describe('Design/template id from list-design-templates'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'read')
    const userId = await resolveUserId(mcp)

    try {
      const found = await designService.findById(args.id, userId)
      if (!found.success || !found.data) throw new Error('Template not found (or not visible to this key)')
      const raw = found.data.envelope.doc
      if (!isDocument(raw)) throw new Error('Template document is not a valid image-editor@1 envelope')
      const originalFields = raw.fields.length
      const document = prepareDesignDocument(raw)
      logMcpCall('get-design-template', { userId, id: args.id })
      return {
        id: found.data.id,
        title: found.data.title,
        isPublic: found.data.isPublic,
        ownerId: found.data.ownerId,
        frame: document.frame,
        fields: document.fields,
        autoFields: originalFields === 0 && document.fields.length > 0,
        document,
        meta: found.data.envelope.meta,
        thumbnails: found.data.thumbnails,
      }
    } catch (error) {
      log.error({ message: 'get-design-template failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to read template')
    }
  },
})
