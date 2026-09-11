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
  description: 'Upload an inline image into the business media library from base64 bytes (use when the image lives in this conversation, not at a URL). Returns the asset record — pass its ID as mediaAssetIds in create-post.',
  inputSchema: {
    imageBase64: z.string().min(1).describe('Base64-encoded image bytes. A data: URI prefix (data:image/png;base64,...) is accepted and overrides mimeType.'),
    mimeType: z.string().regex(/^image\//).describe('Image MIME type, e.g. image/png. Ignored when imageBase64 carries a data-URI prefix.'),
    originalName: z.string().max(255).optional().describe('Filename to store. Defaults to upload.<ext derived from MIME>.'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    const result = await assetService.createFromBase64(userId, {
      data: args.imageBase64,
      mimeType: args.mimeType,
      businessId: mcp.businessId,
      originalName: args.originalName,
    })
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to upload inline image')
    }
    await logMcpCall(mcp, 'upload-asset', result.data.id)
    return { asset: shapeAsset({ ...result.data }) }
  },
})
