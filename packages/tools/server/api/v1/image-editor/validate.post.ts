import { z } from 'zod'
import { validateFields, syncFieldsFromObjects } from '../../../../shared/image-editor/fields'
import { isDocument } from '../../../../shared/image-editor/resolve-rows'
import { requireDesignAuth } from '../../../utils/design-auth'

/**
 * validate-design-document — used by the editor save flow, the admin importer
 * and MCP `validate-design-document`. Returns structured issues; agents use
 * this to check a mutated document before calling update-design.
 */

const validateSchema = z.object({
  document: z.unknown(),
  fieldValues: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export default defineEventHandler(async (event) => {
  await requireDesignAuth(event)
  const body = await readValidatedBody(event, raw => validateSchema.parse(raw))

  const doc = typeof body.document === 'string' ? safeJson(body.document) : body.document
  if (!isDocument(doc)) {
    return { valid: false, issues: [{ code: 'schema', message: 'document.schema must be "magicsync/image-editor@1"' }], fields: [], warnings: [] }
  }

  const synced = syncFieldsFromObjects(doc)
  const issues = validateFields(synced).map(issue => ({
    code: issue.code,
    message: `Field "${issue.name}": ${issue.detail ?? issue.code}`,
  }))

  if (body.fieldValues) {
    for (const [name, value] of Object.entries(body.fieldValues)) {
      issues.push(...valueIssues(name, value, synced))
    }
  }
  for (const field of synced.fields) {
    if (field.name.includes('__')) issues.push({ code: 'invalid_name', message: `Field "${field.name}" must not contain "__"` })
  }

  return {
    valid: issues.length === 0,
    issues,
    fields: synced.fields,
    warnings: [],
  }
})

function valueIssues(name: string, value: string | number | boolean, doc: ReturnType<typeof syncFieldsFromObjects>): Array<{ code: string; message: string }> {
  const field = doc.fields.find(entry => entry.name === name)
  if (!field) {
    return [{ code: 'unknown_field', message: `No field named "${name}" in this document` }]
  }
  if (field.targets[0]?.property === 'image_url' && typeof value === 'string' && value.length > 0 && !safeImageUrl(value)) {
    return [{ code: 'bad_value', message: `"${name}" expects an https image URL` }]
  }
  return []
}

export function safeImageUrl(value: string): boolean {
  return /^https:\/\//.test(value) || value.startsWith('/') || value.startsWith('data:image/')
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
