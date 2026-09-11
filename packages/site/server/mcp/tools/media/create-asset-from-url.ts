import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { assetService } from '#layers/BaseDB/server/services/asset.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

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
  description: 'Download a remote image (or file) over http(s) into the business media library. Returns the asset record — pass its ID as mediaAssetIds in create-post.',
  inputSchema: {
    url: z.string().url().describe('Public http(s) URL of the image or file to import'),
    originalName: z.string().max(255).optional().describe('Filename to store (extension sets the MIME type). Defaults to the URL tail.'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    const result = await assetService.createFromUrl(userId, {
      url: args.url,
      businessId: mcp.businessId,
      originalName: args.originalName,
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to import asset from URL')
    }
    await logMcpCall(mcp, 'create-asset-from-url', result.data.id)
    return { asset: shapeAsset({ ...result.data }) }
  },
})
