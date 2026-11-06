import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { prepareDesignDocument } from '#layers/BaseTools/shared/image-editor/fields'
import { isDocument } from '#layers/BaseTools/shared/image-editor/resolve-rows'
import type { ImageEditorDocument } from '#layers/BaseTools/shared/image-editor/document'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** List the dynamic fields (variables) of a design. */
export default defineMcpTool({
  description: 'List the dynamic fields of a design: name, bound layers and which property each binding writes (text/image_url/color/font_family/font_size/visible). Use these names in render-design (dynamic_fields) or as CSV columns in batch-generate-designs.',
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
      const found = await designService.findById(args.id, userId)
      if (!found.success || !found.data) throw new Error('Design not found (or not visible to this key)')
      const raw = found.data.envelope.doc as ImageEditorDocument | null
      if (!raw) throw new Error('Design has no renderable document')
      const declared = raw.fields?.length ?? 0
      const document = isDocument(raw) ? prepareDesignDocument(raw) : null
      if (!document) throw new Error('Design document is not a valid image-editor@1 envelope')
      const fields = document.fields
      logMcpCall('list-design-variables', { userId, id: args.id, fields: fields.length })
      return {
        count: fields.length,
        autoFields: declared === 0 && fields.length > 0,
        fields: fields.map(field => ({
          name: field.name,
          property: field.targets[0]?.property ?? 'text',
          targets: field.targets.length,
          default: field.default ?? null,
        })),
        message: fields.length === 0
          ? 'No text layers or fields found. Add a text/image layer or bind a layer in Variables.'
          : declared === 0
            ? 'No explicit fields; text layers were auto-exposed as title/content/text_3. Fill these names in render-design or batch rows.'
            : 'Fill one value per field name (or use suffix qualifiers via dynamic_fields).',
      }
    } catch (error) {
      log.error({ message: 'list-design-variables failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to read fields')
    }
  },
})
