import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/**
 * Validate + mutate-free check of a document envelope an agent assembled,
 * plus version history helpers (list/restore stay separate tools).
 */

const validateSchema = z.object({
  document: z.unknown().describe('Full document envelope to check'),
  fill: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
    .describe('Check that these field values would bind (names must exist)'),
})

export default defineMcpTool({
  description: 'Validate an image-editor document before update-design: schema id, field bindings, name rules. Returns valid + issues[] (codes include schema, dupe, invalid_name, no_targets, unknown_field).',
  inputSchema: (() => ({ document: validateSchema.shape.document, fill: validateSchema.shape.fill }))(),
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'read')
    const userId = await resolveUserId(mcp)

    try {
      const { isDocument } = await import('#layers/BaseTools/shared/image-editor/resolve-rows')
      const { prepareDesignDocument, validateFields } = await import('#layers/BaseTools/shared/image-editor/fields')

      if (!isDocument(args.document)) {
        logMcpCall('validate-design-document', { userId, valid: false })
        return { valid: false, issues: [{ code: 'schema', message: 'document.schema must be magicsync/image-editor@1 with pages[] + frame' }] }
      }
      const synced = prepareDesignDocument(args.document)
      const issues = validateFields(synced).map(issue => ({
        code: issue.code as string,
        message: `Field "${issue.name}": ${issue.detail ?? issue.code}`,
      }))
      if (args.fill) {
        for (const name of Object.keys(args.fill)) {
          if (!synced.fields.some(field => field.name === name)) {
            issues.push({ code: 'unknown_field', message: `No field named "${name}" in this document` })
          }
        }
      }
      logMcpCall('validate-design-document', { userId, valid: issues.length === 0, issues: issues.length })
      return { valid: issues.length === 0, issues, fields: synced.fields.map(field => ({ name: field.name, property: field.targets[0]?.property ?? 'text', targets: field.targets.length })) }
    } catch (error) {
      log.error({ message: 'validate-design-document failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Validation failed')
    }
  },
})
