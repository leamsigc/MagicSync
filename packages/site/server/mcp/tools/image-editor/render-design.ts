import { z } from 'zod'
import { renderDesign, type DesignFormat } from '#layers/BaseTools/server/utils/image-editor-render'
import { bindDocument } from '#layers/BaseTools/shared/image-editor/bind-fields'
import { resolveDesignSource } from '#layers/BaseTools/server/utils/design-source'
import type { DesignPrincipal } from '#layers/BaseTools/server/utils/design-auth'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { signAssetPath } from '#layers/BaseShared/server/utils/signed-url'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { mergeFlatFields, describeSource } from '../../utils/design-fields'

/**
 * Single render from MCP. Accepts a stored template id **or raw template /
 * document JSON**, normalizes/dedupes it, binds variables and renders through
 * the same engine as the HTTP route and editor export.
 */

const propertyValues = z.union([z.string(), z.number(), z.boolean()])

export default defineMcpTool({
  description: 'Render an image from a template. Provide templateId (stored design) OR template (raw fabric/Polotno JSON) OR document (image-editor@1 envelope). Fill variables with dynamic_fields: {name, text|image_url|color|font_size|font_family|visible}. Field-less designs auto-expose text layers as title/content/text_3. Returns a stored, signed asset URL.',
  inputSchema: {
    templateId: z.string().min(6).max(80).optional().describe('Stored design/template id'),
    template: z.unknown().optional().describe('Raw fabric v5/v7 or Polotno JSON — normalized server-side'),
    document: z.unknown().optional().describe('Full image-editor@1 document envelope'),
    dynamic_fields: z.array(z.object({
      name: z.string().min(1).max(60).regex(/^[A-Za-z0-9_]+$/, 'Field names are [A-Za-z0-9_]'),
      text: propertyValues.optional(),
      image_url: propertyValues.optional(),
      color: propertyValues.optional(),
      font_family: propertyValues.optional(),
      font_size: propertyValues.optional(),
      visible: propertyValues.optional(),
    })).max(64).optional().describe('Variable values; only pass the properties you want to set'),
    dynamic_fields_flat: z.record(z.string(), propertyValues).optional()
      .describe('Flat map. Accepts canonical fields__{name}__{suffix} keys OR plain {name: value} keys (resolved against the document field target). Applied after dynamic_fields.'),
    format: z.enum(['png', 'jpeg', 'webp']).default('png'),
    scale: z.number().min(0.5).max(4).default(1),
    page: z.number().int().min(0).max(50).default(0),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      if (!hasSource(args)) {
        throw new Error('Provide templateId, template JSON, or a document envelope')
      }
      const principal: DesignPrincipal = { userId, viaKey: true }
      const source = await resolveDesignSource(principal, {
        templateId: args.templateId,
        template: args.template,
        document: args.document,
      })
      const document = source.document

      const merged = mergeFlatFields(document, args.dynamic_fields, args.dynamic_fields_flat)
      const binding = hasFieldValues(merged)
        ? bindDocument(document, { dynamic_fields: merged.entries, dynamic_fields_flat: merged.qualified })
        : { warnings: [] }

      const output = await renderDesign({
        document,
        pageIndex: args.page,
        format: args.format as DesignFormat,
        scale: args.scale,
      })
      const stored = await assetService.createFromBase64(userId, {
        data: `data:${output.mimeType};base64,${output.buffer.toString('base64')}`,
        mimeType: output.mimeType,
        originalName: `design-${(source.templateId ?? 'inline').slice(0, 8)}-p${args.page}.${args.format}`,
        businessId: mcp.businessId,
      })
      if (!stored.success || !stored.data) throw new Error(`Render stored, but the asset failed: ${stored.error}`)
      logMcpCall('render-design', { userId, id: source.templateId ?? 'inline', bytes: output.buffer.length })
      return {
        assetId: stored.data.id,
        url: signAssetPath(stored.data.url).url,
        width: output.width,
        height: output.height,
        source: describeSource(source.templateId, args.document !== undefined),
        appliedFields: appliedFieldNames(merged),
        fields: document.fields.map(field => ({ name: field.name, property: field.targets[0]?.property ?? 'text' })),
        bindingWarnings: binding.warnings.slice(0, 10),
        warnings: output.warnings.slice(0, 10),
        importWarnings: source.warnings.slice(0, 10),
        followUp: 'Pass this asset_id to media tools, or use batch-generate-designs for many rows.',
      }
    } catch (error) {
      log.error({ message: 'render-design failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Render failed')
    }
  },
})

function hasSource(args: { templateId?: string; template?: unknown; document?: unknown }): boolean {
  return Boolean(args.templateId || args.template !== undefined || args.document !== undefined)
}

function hasFieldValues(merged: ReturnType<typeof mergeFlatFields>): boolean {
  return merged.entries.length > 0 || Object.keys(merged.qualified).length > 0
}

function appliedFieldNames(merged: ReturnType<typeof mergeFlatFields>): string[] {
  return [...new Set([
    ...merged.entries.map(entry => entry.name),
    ...merged.plain,
    ...Object.keys(merged.qualified).map(key => key.split('__')[1]).filter(Boolean),
  ])]
}
