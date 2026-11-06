import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Create a design — from a public template, from a raw v5/v7 JSON, or blank. */
export default defineMcpTool({
  description: 'Create a design for the image editor. Sources: duplicate an existing template (templateId), send raw v5/v7 fabric JSON (template — normalized on the way in), or blank (width/height). Returns the new design id.',
  inputSchema: {
    templateId: z.string().min(6).max(80).optional().describe('Duplicate an existing design/template as the starting point'),
    template: z.unknown().optional().describe('Raw fabric v5/v7 template JSON (Kuaitu-style) to normalize + import'),
    name: z.string().max(120).optional().describe('Design title (defaults to source title or "New design")'),
    width: z.number().int().min(10).max(8192).optional(),
    height: z.number().int().min(10).max(8192).optional(),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      if (args.templateId) {
        const dup = await designService.duplicate(args.templateId, userId, args.name)
        if (!dup.success || !dup.data) throw new Error(`Could not duplicate template: ${dup.error}`)
        const { prepareDesignDocument } = await import('#layers/BaseTools/shared/image-editor/fields')
        const { isDocument } = await import('#layers/BaseTools/shared/image-editor/resolve-rows')
        const raw = dup.data.envelope.doc
        const document = isDocument(raw) ? prepareDesignDocument(raw) : null
        // Persist the cleaned document so duplicate layers/ids don't survive in
        // the copy and reappear as text overlays during batch renders.
        if (document) await designService.update(dup.data.id, userId, { doc: document }, { snapshot: false })
        logMcpCall('create-design(dup)', { userId, id: dup.data.id })
        return {
          id: dup.data.id,
          title: dup.data.title,
          fields: document?.fields.map(field => ({ name: field.name, property: field.targets[0]?.property ?? 'text' })) ?? [],
          message: 'Design created from template. Fields inherit from the source.',
        }
      }
      if (args.template !== undefined) {
        const { normalizeDocument } = await import('#layers/BaseTools/shared/image-editor/normalize')
        const source = typeof args.template === 'string' ? JSON.parse(args.template) : args.template
        const { document } = normalizeDocument({ json: source })
        const { prepareDesignDocument, syncFieldsFromObjects } = await import('#layers/BaseTools/shared/image-editor/fields')
        const ready = prepareDesignDocument(syncFieldsFromObjects(document))
        const created = await designService.create(userId, {
          title: args.name ?? 'Imported design',
          doc: ready,
          meta: { source: 'mcp-import' },
        })
        if (!created.success || !created.data) throw new Error(`Import rejected: ${created.error}`)
        logMcpCall('create-design(import)', { userId, id: created.data.id })
        return { id: created.data.id, title: created.data.title, fields: ready.fields, message: 'Template normalized and imported.' }
      }
      const { createEmptyDocument } = await import('#layers/BaseTools/shared/image-editor/document')
      const created = await designService.create(userId, {
        title: args.name ?? 'New design',
        doc: createEmptyDocument(args.width ?? 1242, args.height ?? 1660),
        meta: { source: 'mcp-blank' },
      })
      if (!created.success || !created.data) throw new Error(`Create failed: ${created.error}`)
      logMcpCall('create-design(blank)', { userId, id: created.data.id })
      return { id: created.data.id, title: created.data.title, message: 'Blank design created.' }
    } catch (error) {
      log.error({ message: 'create-design failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to create design')
    }
  },
})
