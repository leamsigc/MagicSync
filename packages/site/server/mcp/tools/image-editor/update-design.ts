import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { isDocument } from '#layers/BaseTools/shared/image-editor/resolve-rows'
import { prepareDesignDocument } from '#layers/BaseTools/shared/image-editor/fields'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Mutate a design document (full-document CRUD) with validation. */
export default defineMcpTool({
  description: 'Update a design you own with a full image-editor document envelope (**schema "magicsync/image-editor@1"**, pages[], frame). Fetch with get-design-template first, mutate the JSON (add/edit/remove layers, change text/colors/images, resize the frame in frame{}), then save here. Non-owner or bad schema is rejected.',
  inputSchema: {
    id: z.string().min(6).max(80).describe('Design id'),
    document: z.unknown().describe('Full document envelope as returned by get-design-template'),
    title: z.string().min(1).max(200).optional().describe('Rename the design'),
    isPublic: z.boolean().optional().describe('Publish to the template library / unpublish'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const doc = isDocument(args.document) ? prepareDesignDocument(args.document) : args.document
      const result = await designService.update(args.id, userId, {
        ...(args.title ? { title: args.title } : {}),
        doc,
        ...(args.isPublic !== undefined ? { isPublic: args.isPublic } : {}),
      })
      if (!result.success || !result.data) {
        throw new Error(result.error === 'Design not found' ? 'Design not found, run get-design-template first' : `Update rejected: ${result.error}`)
      }
      logMcpCall('update-design', { userId, id: args.id })
      return {
        id: result.data.id,
        savedAt: result.data.updatedAt,
        message: 'Design saved. Verify with render-design before announcing success.',
      }
    } catch (error) {
      log.error({ message: 'update-design failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to update design')
    }
  },
})
