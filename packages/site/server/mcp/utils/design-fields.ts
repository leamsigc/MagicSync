import type { DynamicFieldEntry, DynamicFieldValue } from '#layers/BaseTools/shared/image-editor/bind-fields'
import type { ImageEditorDocument } from '#layers/BaseTools/shared/image-editor/document'

// MCP callers often send `dynamic_fields_flat: { title: "Spring" }` instead of
// the canonical `fields__title__text`. Accept both: plain keys are resolved
// against the document's field targets, which also picks image/color/font
// fields correctly. Genuinely unknown keys are passed through so the binder
// reports them instead of silently discarding the caller's data.

export interface MergedFlatFields {
  entries: DynamicFieldEntry[]
  qualified: Record<string, DynamicFieldValue>
  plain: string[]
}

export function mergeFlatFields(
  document: ImageEditorDocument,
  dynamic: DynamicFieldEntry[] | undefined,
  flat: Record<string, DynamicFieldValue> | undefined,
): MergedFlatFields {
  const entries = [...(dynamic ?? [])]
  const qualified: Record<string, DynamicFieldValue> = {}
  const plain: string[] = []

  for (const [key, value] of Object.entries(flat ?? {})) {
    if (key.startsWith('fields__')) {
      qualified[key] = value
      continue
    }
    const field = document.fields.find(candidate => candidate.name === key)
    if (!field) {
      qualified[key] = value
      continue
    }
    entries.push({ name: key, [field.targets[0]?.property ?? 'text']: value })
    plain.push(key)
  }

  return { entries, qualified, plain }
}

/** Human-readable source label for render/batch responses. */
export function describeSource(templateId: string | null, hasDocument: boolean): 'templateId' | 'document' | 'template' {
  if (templateId) return 'templateId'
  return hasDocument ? 'document' : 'template'
}
