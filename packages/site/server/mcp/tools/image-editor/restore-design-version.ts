import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { isDocument } from '#layers/BaseTools/shared/image-editor/resolve-rows'
import { prepareDesignDocument } from '#layers/BaseTools/shared/image-editor/fields'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Restore an old design version (owner-only). */
export default defineMcpTool({
  description: 'Restore one saved version of your design: replaces the live document with the version JSON (a new version is snapshotted first, so this is not destructive).',
  inputSchema: {
    id: z.string().min(6).max(80).describe('Design id'),
    versionId: z.string().min(6).max(80).describe('Version id from list-design-versions'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const found = await designService.getVersion(args.id, userId, args.versionId)
      if (!found.success || !found.data) throw new Error('Version not found (owner only)')
      const parsed = z.object({ doc: z.unknown() }).safeParse(JSON.parse(found.data.content))
      if (!parsed.success) throw new Error('Saved version has no document')
      const raw = parsed.data.doc
      if (!isDocument(raw)) throw new Error('Saved version is not a valid image-editor document')
      const result = await designService.update(args.id, userId, { doc: prepareDesignDocument(raw), title: found.data.title })
      if (!result.success || !result.data) throw new Error(`Restore failed: ${result.error}`)
      logMcpCall('restore-design-version', { userId, id: args.id, version: found.data.version })
      return { id: args.id, restoredVersion: found.data.version, message: 'Version restored; a fresh version was snapshotted for undo.' }
    } catch (error) {
      log.error({ message: 'restore-design-version failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Failed to restore version')
    }
  },
})
