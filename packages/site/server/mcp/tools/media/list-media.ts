import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

function shapeAsset(a: Record<string, unknown>) {
  return {
    id: a.id,
    filename: a.filename,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    url: a.url,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  }
}

export default defineMcpTool({
  description: 'List media library assets for the business, newest first. Use the returned IDs as mediaAssetIds in create-post — never raw URLs.',
  inputSchema: {
    mimeType: z.enum(['image', 'video']).optional().describe('Only images or only videos'),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(20),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    const result = await assetService.findByBusinessId(mcp.businessId, userId, {
      pagination: { page: args.page, limit: args.limit },
      filters: args.mimeType ? { mimeType: args.mimeType } : {},
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to list media')
    }
    return {
      assets: result.data.map(a => shapeAsset(a as unknown as Record<string, unknown>)),
      pagination: result.pagination,
    }
  },
})
