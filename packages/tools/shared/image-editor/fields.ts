import {
  AUTO_FIELD_RE,
  DOCUMENT_SCHEMA_ID,
  type DesignField,
  type EditorObject,
  type ImageEditorDocument,
} from './document'
import { aliasSuffix, inferSuffixForObject } from './field-aliases'

/**
 * Field model helpers: build DesignFields from `{}` layer-name syntax and
 * legacy `linkData`, validate them, and sync both directions.
 */

export interface FieldValidationIssue {
  code: 'dupe' | 'invalid_name' | 'no_targets' | 'bad_suffix'
  name: string
  detail?: string
}

export function extractAutoFieldName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const match = AUTO_FIELD_RE.exec(name.trim())
  return match ? match[1] : null
}

export function extractAutoFieldSuffix(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined
  const match = AUTO_FIELD_RE.exec(name.trim())
  return match?.[2]
}

/**
 * Recompute `document.fields` from the objects' `{name}` layer names plus any
 * legacy `linkData` bindings. Explicit fields whose targets still exist are
 * preserved; `{}`-derived fields are rebuilt from scratch.
 */
export function syncFieldsFromObjects(doc: ImageEditorDocument): ImageEditorDocument {
  const byName = new Map<string, DesignField>()
  const pages = [...doc.pages]
  for (const field of doc.fields) byName.set(field.name, { ...field, targets: [] })

  for (const page of pages) {
    for (const obj of allObjectsDeep(page.objects)) {
      const objectId = objectIdOf(obj)
      attachLegacyLinkData(byName, obj, objectId)
      attachAutoField(byName, obj, objectId)
    }
  }

  const fields = [...byName.values()].filter((field) => field.targets.length > 0)
  return { ...doc, fields: dedupeTargets(fields) }
}

/** Find a field whose object id is referenced but whose name lives only in legacy linkData. */
function attachLegacyLinkData(byName: Map<string, DesignField>, obj: EditorObject, objectId: string) {
  const linkData = obj.linkData
  if (!Array.isArray(linkData) || linkData.length !== 2) return
  const property = aliasSuffix(linkData[0])
  const name = String(linkData[1] ?? '').trim()
  if (!property || !name) return
  const field = byName.get(name) ?? { name, targets: [] }
  field.targets.push({ objectId, property })
  byName.set(name, field)
}

function attachAutoField(byName: Map<string, DesignField>, obj: EditorObject, objectId: string) {
  const name = extractAutoFieldName(obj.name)
  if (!name) return
  const aliasRaw = extractAutoFieldSuffix(obj.name)
  const property = (aliasRaw && aliasSuffix(aliasRaw)) || inferSuffixForObject(obj)
  const field = byName.get(name) ?? { name, targets: [] }
  field.targets.push({ objectId, property })
  byName.set(name, field)
}

/** Dedupe layers first, then expose text layers as fields when none are declared. */
export function prepareDesignDocument(doc: ImageEditorDocument): ImageEditorDocument {
  return deriveTextFields(dedupeDocumentObjects(doc))
}

/**
 * Remove exact duplicate layers and make conflicting IDs unique.
 *
 * A duplicated object (same id and same visual JSON) is a fossil of a paste or
 * import bug: binding one copy left the other at the old text, producing the
 * "second row writes over the first" overlay. Same-id objects that differ get a
 * fresh id so both are preserved.
 */
export function dedupeObjects(objects: EditorObject[]): EditorObject[] {
  const signatures = new Map<string, string>()
  const out: EditorObject[] = []
  for (const obj of objects) {
    if (Array.isArray(obj.objects)) obj.objects = dedupeObjects(obj.objects as EditorObject[])
    const id = typeof obj.id === 'string' ? obj.id : ''
    if (!id) {
      out.push(obj)
      continue
    }
    const { id: _ignored, ...rest } = obj
    const signature = JSON.stringify(rest)
    const prior = signatures.get(id)
    if (prior === signature) continue
    if (prior !== undefined) obj.id = `obj-${Math.random().toString(36).slice(2, 10)}`
    signatures.set(String(obj.id), signature)
    out.push(obj)
  }
  return out
}

export function dedupeDocumentObjects(doc: ImageEditorDocument): ImageEditorDocument {
  return {
    ...doc,
    pages: doc.pages.map(page => ({ ...page, objects: dedupeObjects(page.objects) })),
  }
}

/**
 * Auto-variable fallback for imported/legacy documents with no fields.
 *
 * Text layers become `title`, `content`, `text_3`… (largest font first) while
 * keeping their current text as the visible default. The batch binder can then
 * replace them from CSV columns without forcing the user to author variables
 * first. Only runs when the document has no fields at all.
 */
export function deriveTextFields(doc: ImageEditorDocument): ImageEditorDocument {
  if (doc.fields.length > 0) return doc
  const candidates = doc.pages
    .flatMap(page => allObjectsDeep(page.objects))
    .filter(obj => typeof obj.text === 'string' && obj.text.trim().length > 0)
    .sort((a, b) => Number(b.fontSize ?? 0) - Number(a.fontSize ?? 0))
    .slice(0, 20)
  if (candidates.length === 0) return doc
  const fields = candidates.map((obj, index) => ({
    name: index === 0 ? 'title' : index === 1 ? 'content' : `text_${index + 1}`,
    targets: [{ objectId: objectIdOf(obj), property: 'text' as const }],
  }))
  return { ...doc, fields }
}

export function validateFields(doc: ImageEditorDocument): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = []
  const seen = new Set<string>()
  const knownIds = new Set(doc.pages.flatMap((page) => allObjectsDeep(page.objects).map((obj) => objectIdOf(obj))))
  for (const field of doc.fields) {
    if (seen.has(field.name)) issues.push({ code: 'dupe', name: field.name })
    seen.add(field.name)
    if (!/^[A-Za-z0-9_]+$/.test(field.name)) issues.push({ code: 'invalid_name', name: field.name })
    if (field.targets.length === 0) issues.push({ code: 'no_targets', name: field.name })
    for (const target of field.targets) {
      if (!knownIds.has(target.objectId)) issues.push({ code: 'no_targets', name: field.name, detail: `missing object ${target.objectId}` })
    }
  }
  return issues
}

export function objectIdOf(obj: EditorObject): string {
  if (typeof obj.id === 'string' && obj.id) return obj.id
  const generated = `obj-${Math.random().toString(36).slice(2, 10)}`
  obj.id = generated
  return generated
}

function allObjectsDeep(objects: EditorObject[]): EditorObject[] {
  const out: EditorObject[] = []
  for (const obj of objects) {
    out.push(obj)
    out.push(...allObjectsDeep(Array.isArray(obj.objects) ? (obj.objects as EditorObject[]) : []))
  }
  return out
}

function dedupeTargets(fields: DesignField[]): DesignField[] {
  return fields.map((field) => ({
    ...field,
    targets: field.targets.filter((target, index) =>
      field.targets.findIndex((other) => other.objectId === target.objectId && other.property === target.property) === index),
  }))
}

/** Ensure the document payload always carries the schema id before storage. */
export function withSchema(doc: ImageEditorDocument): ImageEditorDocument {
  return { ...doc, schema: DOCUMENT_SCHEMA_ID }
}
