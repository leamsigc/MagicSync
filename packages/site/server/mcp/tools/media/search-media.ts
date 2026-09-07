import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'Find media by filename text. NOTE: the library has no full-text index — this scans the newest 100 assets and matches query against filename/original name case-insensitively. Prefer list-media for browsing.',
  inputSchema: {
    query: z.string().min(1).describe('Text to match against filenames'),
    mimeType: z.enum(['image', 'video']).optional().describe('Only images or only videos'),
    limit: z.number().int().min(1).max(20).default(10).describe('Max matches to return'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    const result = await assetService.findByBusinessId(mcp.businessId, userId, {
      pagination: { page: 1, limit: 100 },
      filters: args.mimeType ? { mimeType: args.mimeType } : {},
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to search media')
    }

    const q = args.query.toLowerCase()
    const matches = (result.data as Array<Record<string, unknown>>)
      .filter(a => String(a.filename ?? '').toLowerCase().includes(q)
        || String(a.originalName ?? '').toLowerCase().includes(q))
      .slice(0, args.limit)
      .map(a => ({
        id: a.id,
        filename: a.filename,
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
      }))

    return { query: args.query, scanned: result.data.length, matches }
  },
})
