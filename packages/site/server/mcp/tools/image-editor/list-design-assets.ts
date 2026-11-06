import { z } from 'zod'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { SHAPE_CATALOG, SHAPE_CATEGORIES } from '#layers/BaseTools/shared/image-editor/shapes'
import { FONT_MANIFEST, FONT_PAIRS } from '#layers/BaseTools/shared/image-editor/fonts-manifest'

/**
 * Asset catalogs for agents: shapes, fonts, and icon search via the public
 * Iconify search API (no key needed).
 */

export default defineMcpTool({
  description: 'List design asset catalogs: shapes (insertable SVG paths), bundled fonts, and optional Iconify icon search by query. Shape paths are fabric path objects; icons are SVG data URLs ready to insert as image layers.',
  inputSchema: {
    kind: z.enum(['shapes', 'fonts', 'icons']).describe('shapes = shape pack; fonts = bundled font list; icons = Iconify search'),
    query: z.string().min(1).max(80).optional().describe('Icon search query (kind=icons only), e.g. "arrow" or "social facebook"'),
    limit: z.number().int().min(1).max(30).default(12).describe('Max icons returned (kind=icons only)'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'read')
    const userId = await resolveUserId(mcp)

    try {
      if (args.kind === 'shapes') {
        logMcpCall('list-design-shapes', { userId })
        return {
          categories: SHAPE_CATEGORIES,
          shapes: SHAPE_CATALOG.map(entry => ({ id: entry.id, name: entry.name, category: entry.category, kind: entry.kind, path: entry.path ?? null, fill: entry.fill })),
        }
      }
      if (args.kind === 'fonts') {
        logMcpCall('list-design-fonts', { userId })
        return {
          fonts: FONT_MANIFEST.map(entry => ({ family: entry.family, category: entry.category })),
          pairs: FONT_PAIRS,
        }
      }
      const query = args.query?.trim() ?? ''
      if (!query) throw new Error('Provide a query for icon search')
      const response = await safeFetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${args.limit}`,
        { timeoutMs: 10_000, maxBytes: 1_000_000 },
      )
      if (response.status < 200 || response.status >= 300) throw new Error('Iconify search unavailable')
      const payload = JSON.parse(String(response.body)) as { icons?: string[]; total?: number }
      const iconNames = payload.icons ?? []
      logMcpCall('list-design-shapes(icons)', { userId, query, count: iconNames.length })
      return {
        total: payload.total ?? iconNames.length,
        icons: iconNames.map(name => ({
          id: name,
          name,
          svg: `https://api.iconify.design/${name}.svg`,
          message: 'Fetch the SVG URL, then store it as a design asset (assets/[name]) or set it as image_url for a field.',
        })),
      }
    } catch (error) {
      log.error({ message: 'asset catalog tool failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Catalog lookup failed')
    }
  },
})
