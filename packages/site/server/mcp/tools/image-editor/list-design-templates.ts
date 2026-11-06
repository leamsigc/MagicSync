import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { prepareDesignDocument } from '#layers/BaseTools/shared/image-editor/fields'
import { isDocument } from '#layers/BaseTools/shared/image-editor/resolve-rows'
import type { ImageEditorDocument } from '#layers/BaseTools/shared/image-editor/document'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Browse public design templates + the caller's own designs. */
export default defineMcpTool({
  description: 'List design templates and saved designs usable by the image editor. Returns id, title, published flag and page/field counts — pass an id to get-design-template to fetch the full document.',
  inputSchema: {
    scope: z.enum(['public', 'mine', 'all']).default('all').describe('public = template library; mine = user designs; all'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'read')
    const userId = await resolveUserId(mcp)

    try {
      const owned = await designService.list(userId, {}, { page: 1, limit: 50 })
      const mine = owned.success ? owned.data : []
      let templates: typeof mine = []
      if (args.scope !== 'mine') {
        const library = await designService.listPublic({}, { page: 1, limit: 50 })
        templates = library.success ? library.data : []
      }
      const summary = (rows: typeof mine) => rows.map((row) => {
        const doc = row.envelope.doc as ImageEditorDocument | null
        const prepared = isDocument(doc) ? prepareDesignDocument(doc) : null
        return {
          id: row.id,
          title: row.title,
          isPublic: row.isPublic,
          pages: prepared?.pages.length ?? 0,
          fields: prepared?.fields.map(field => field.name) ?? [],
        }
      })
      const mineSummary = summary(mine)
      const publicSummary = summary(templates).filter(entry => !mineSummary.some(row => row.id === entry.id))
      logMcpCall('list-design-templates', { userId, mine: mineSummary.length, templates: publicSummary.length })
      return {
        message: `Found ${publicSummary.length} templates and ${mineSummary.length} own designs. Pass an id to get-design-template for details.`,
        templates: args.scope === 'mine' ? [] : publicSummary,
        designs: args.scope === 'public' ? [] : mineSummary,
      }
    } catch (error) {
      log.error({ message: 'list-design-templates failed', error: String(error) })
      throw new Error('Failed to list designs')
    }
  },
})
