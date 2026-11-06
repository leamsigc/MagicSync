import { z } from 'zod'
import { bindDocument, type FieldValues } from '#layers/BaseTools/shared/image-editor/bind-fields'
import { renderDesign } from '#layers/BaseTools/server/utils/image-editor-render'
import { resolveDesignSource } from '#layers/BaseTools/server/utils/design-source'
import type { DesignPrincipal } from '#layers/BaseTools/server/utils/design-auth'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { signAssetPath } from '#layers/BaseShared/server/utils/signed-url'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { describeSource } from '../../utils/design-fields'

/**
 * Batch generation from MCP — one image per row, from a stored template id or
 * raw template/document JSON. Every row renders from a fresh clone so row N
 * never inherits row N-1's text or layer state.
 */

const MAX_ROWS = 50
const propertyValues = z.union([z.string(), z.number(), z.boolean()])

export default defineMcpTool({
  description: 'Generate many images from one template. Source: templateId OR template (raw fabric/Polotno JSON) OR document (image-editor@1). rows = one variable map per image (like CSV); values = cartesian arrays. Field-less designs auto-expose text layers as title/content/text_3. Returns stored signed asset URLs per row.',
  inputSchema: {
    templateId: z.string().min(6).max(80).optional().describe('Stored template id'),
    template: z.unknown().optional().describe('Raw fabric v5/v7 or Polotno JSON — normalized server-side'),
    document: z.unknown().optional().describe('Full image-editor@1 document envelope'),
    rows: z.array(z.record(z.string(), propertyValues)).max(MAX_ROWS).optional()
      .describe('One map per image, e.g. [{"title":"Spring Sale","content":"50% OFF"}]. Field names come from list-design-variables or the auto title/content variables.'),
    values: z.record(z.string(), z.array(propertyValues)).optional()
      .describe('Cartesian mode: {title:[A,B], content:[1,2]} → 4 images. Max 100 combinations.'),
    format: z.enum(['png', 'jpeg', 'webp']).default('png'),
    scale: z.number().min(0.5).max(4).default(1),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      if (!hasSource(args)) {
        throw new Error('Provide templateId, template JSON, or a document envelope')
      }
      const combos = resolveCombos(args)

      const principal: DesignPrincipal = { userId, viaKey: true }
      const source = await resolveDesignSource(principal, {
        templateId: args.templateId,
        template: args.template,
        document: args.document,
      })
      const base = source.document

      const renders: Array<{ index: number; assetId: string; url: string; width?: number; height?: number }> = []
      const failures: Array<{ index: number; error: string }> = []
      const unknownFields = new Set<string>()
      const ignoredKeys = new Set<string>()

      for (const [index, row] of combos.entries()) {
        try {
          // bindDocument mutates; a shared document made row 2 draw over row 1.
          const document = structuredClone(base)
          const bound = bindDocument(document, { row } as FieldValues)
          for (const warning of bound.warnings) {
            for (const name of warning.unknownFields) unknownFields.add(name)
            for (const key of warning.ignoredKeys) ignoredKeys.add(key)
          }
          const output = await renderDesign({ document, format: args.format as 'png' | 'jpeg' | 'webp', scale: args.scale })
          const stored = await storeRender(userId, output, index, args.format, mcp.businessId)
          renders.push({ index, ...stored })
        } catch (rowError) {
          const message = rowError instanceof Error ? rowError.message.slice(0, 180) : 'Render failed'
          failures.push({ index, error: message })
        }
      }
      logMcpCall('batch-generate-designs', { userId, id: source.templateId ?? 'inline', ok: renders.length, failed: failures.length })
      return {
        requested: combos.length,
        count: renders.length,
        renders,
        failures,
        source: describeSource(source.templateId, args.document !== undefined),
        fields: base.fields.map(field => ({ name: field.name, property: field.targets[0]?.property ?? 'text' })),
        bindingWarnings: {
          unknownFields: [...unknownFields],
          ignoredKeys: [...ignoredKeys],
        },
        importWarnings: source.warnings.slice(0, 10),
        message: batchMessage(renders.length, combos.length),
      }
    } catch (error) {
      log.error({ message: 'batch-generate-designs failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Batch generation failed')
    }
  },
})

function hasSource(args: { templateId?: string; template?: unknown; document?: unknown }): boolean {
  return Boolean(args.templateId || args.template !== undefined || args.document !== undefined)
}

function resolveCombos(args: {
  rows?: Array<Record<string, string | number | boolean>>
  values?: Record<string, Array<string | number | boolean>>
}): Array<Record<string, string | number | boolean>> {
  if (Boolean(args.rows) === Boolean(args.values)) {
    throw new Error(args.rows ? 'Pass rows OR values, not both' : 'Provide rows (row maps) or values (cartesian arrays)')
  }
  const combos = args.rows ?? cartesianRows(args.values ?? {})
  if (combos.length === 0) throw new Error('Provide rows (row maps) or values (cartesian arrays)')
  if (combos.length > MAX_ROWS) throw new Error(`Row count ${combos.length} exceeds the ${MAX_ROWS} sync limit`)
  return combos
}

async function storeRender(
  userId: string,
  output: Awaited<ReturnType<typeof renderDesign>>,
  index: number,
  format: string,
  businessId: string,
): Promise<{ assetId: string; url: string; width: number; height: number }> {
  const stored = await assetService.createFromBase64(userId, {
    data: `data:${output.mimeType};base64,${output.buffer.toString('base64')}`,
    mimeType: output.mimeType,
    originalName: `design-batch-${String(index).padStart(4, '0')}.${format}`,
    businessId,
  })
  if (!stored.success || !stored.data) throw new Error(stored.error ?? 'Asset store failed')
  return { assetId: stored.data.id, url: signAssetPath(stored.data.url).url, width: output.width, height: output.height }
}

function batchMessage(ok: number, requested: number): string {
  return ok === 0
    ? 'Every row failed — check field names against list-design-variables.'
    : `${ok}/${requested} images generated and stored as assets.`
}

function cartesianRows(values: Record<string, Array<string | number | boolean>>): Array<Record<string, string | number | boolean>> {
  let combos: Array<Record<string, string | number | boolean>> = [{}]
  for (const [name, list] of Object.entries(values)) {
    if (!Array.isArray(list) || list.length === 0) continue
    const next: Array<Record<string, string | number | boolean>> = []
    for (const combo of combos) {
      for (const value of list) next.push({ ...combo, [name]: value })
    }
    combos = next
    if (combos.length > 100) throw new Error(`Cartesian combinations exceed the 100 limit (${combos.length})`)
  }
  return combos
}
