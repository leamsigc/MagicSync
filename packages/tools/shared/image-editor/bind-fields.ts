import {
  FIELD_SUFFIXES,
  FLAT_FIELD_RE,
  type DesignField,
  type EditorObject,
  type FieldSuffix,
  type ImageEditorDocument,
} from './document'
import { FONT_ALIASES } from './field-aliases'

/**
 * Field binder — the exact automation contract:
 *
 *   1. defaults from the template
 *   2. every `dynamic_fields` entry in array order
 *   3. `dynamic_fields_flat` appended LAST → wins on overlap
 *   4. flat keys `fields__{name}__{suffix}` that don't match are ignored
 *   5. unknown field names are ignored + reported as warnings (names only)
 *   6. values are NEVER persisted or echoed — this module returns only
 *      the mutated objects and warning names.
 */

export type DynamicFieldValue = string | number | boolean

export interface DynamicFieldEntry extends Partial<Record<FieldSuffix, DynamicFieldValue>> {
  name: string
}

export interface BindResult {
  objects: Map<string, EditorObject>
  warnings: Array<{ index: number; ignoredKeys: string[]; unknownFields: string[] }>
}

export interface FieldValues {
  /** (name → value) row mode */
  row?: Record<string, DynamicFieldValue>
  /** advanced shapes */
  dynamic_fields?: DynamicFieldEntry[]
  dynamic_fields_flat?: Record<string, string | number | boolean>
}

const VALUE_SUFFIXES: FieldSuffix[] = [...FIELD_SUFFIXES]

/** Coerce an incoming value for a given suffix. */
function coerce(suffix: FieldSuffix, value: DynamicFieldValue): DynamicFieldValue {
  if (suffix === 'visible') {
    return value === true || value === 'true' || value === 1 || value === '1'
  }
  if (suffix === 'font_size') return Number(value) || 0
  if (suffix === 'font_family') {
    const str = String(value)
    return FONT_ALIASES[str] ?? str
  }
  return value
}

/** Flatten one FieldValues shape into (name → {suffix → value}), in merge order. */
function flattenValues(values: FieldValues[]): { params: Map<string, Partial<Record<FieldSuffix, DynamicFieldValue>>>; ignored: string[]; unknown: string[] } {
  const params = new Map<string, Partial<Record<FieldSuffix, DynamicFieldValue>>>()
  const ignored: string[] = []
  const unknown: string[] = []

  for (const valuesEntry of values) {
    if (valuesEntry.row) pushRowParams(params, valuesEntry.row, unknown)
    if (Array.isArray(valuesEntry.dynamic_fields)) pushArrayParams(params, valuesEntry.dynamic_fields, unknown)
    if (valuesEntry.dynamic_fields_flat) pushFlatParams(params, valuesEntry.dynamic_fields_flat, ignored, unknown)
  }
  return { params, ignored, unknown }
}

/**
 * Row mode: plain names use the field definition's primary suffix; qualified
 * `fields__name__suffix` columns are treated as flat values.
 */
function pushRowParams(
  params: Map<string, Partial<Record<FieldSuffix, DynamicFieldValue>>>,
  row: Record<string, DynamicFieldValue>,
  unknown: string[],
): void {
  for (const [name, value] of Object.entries(row)) {
    const match = FLAT_FIELD_RE.exec(name)
    if (match && isSuffix(match[2])) pushParam(params, match[1], { [match[2]]: value }, unknown)
    else pushParam(params, name, { row: value }, unknown)
  }
}

function pushArrayParams(
  params: Map<string, Partial<Record<FieldSuffix, DynamicFieldValue>>>,
  entries: DynamicFieldEntry[],
  unknown: string[],
): void {
  for (const entry of entries) {
    const { name, ...props } = entry
    pushParam(params, name, props, unknown)
  }
}

function pushFlatParams(
  params: Map<string, Partial<Record<FieldSuffix, DynamicFieldValue>>>,
  flat: Record<string, DynamicFieldValue>,
  ignored: string[],
  unknown: string[],
): void {
  for (const [key, rawValue] of Object.entries(flat)) {
    const match = FLAT_FIELD_RE.exec(key)
    if (!match || !isSuffix(match[2])) {
      ignored.push(key)
      continue
    }
    pushParam(params, match[1], { [match[2]]: rawValue }, unknown)
  }
}

function isSuffix(value: string): value is FieldSuffix {
  return (VALUE_SUFFIXES as string[]).includes(value)
}

function pushParam(
  params: Map<string, Partial<Record<FieldSuffix, DynamicFieldValue>>>,
  name: string,
  props: Partial<Record<FieldSuffix, DynamicFieldValue>>,
  unknown: string[],
) {
  // `row` is not a FieldSuffix — it marks a single value that is resolved
  // against the field's primary property later. Keep it in the map.
  if (!params.has(name)) unknown.push(name)
  const existing = params.get(name) ?? {}
  for (const [suffix, value] of Object.entries(props)) {
    if (suffix === 'row' || isSuffix(suffix)) {
      (existing as Record<string, DynamicFieldValue>)[suffix] = value as DynamicFieldValue
    }
  }
  params.set(name, existing)
}

export function bindDocument(
  doc: ImageEditorDocument,
  ...values: FieldValues[]
): BindResult {
  const warnings: Array<{ index: number; ignoredKeys: string[]; unknownFields: string[] }> = []
  const flattened = flattenValues(values)
  const objects = new Map<string, EditorObject>()
  const fieldsByName = new Map(doc.fields.map((field) => [field.name, field]))

  for (const field of doc.fields) {
    for (const target of field.targets) {
      const targets = findObjects(doc, target.objectId)
      if (targets[0]) objects.set(target.objectId, targets[0])
    }
  }

  let index = 0
  for (const [name, suffixMap] of flattened.params) {
    index += 1
    const field = fieldsByName.get(name)
    if (!field) {
      // unknown → reported but skipped; already collected in `unknown`
      continue
    }
    for (const target of field.targets) {
      for (const obj of findObjects(doc, target.objectId)) applyParams(obj, name, field, suffixMap)
    }
    warnings.push({ index, ignoredKeys: [], unknownFields: [] })
  }

  const meaningful = warnings.filter((w) => w.ignoredKeys.length > 0 || w.unknownFields.length > 0)
  if (flattened.ignored.length > 0 || flattened.unknown.length > 0) {
    meaningful.push({
      index: -1,
      ignoredKeys: dedupe(flattened.ignored),
      unknownFields: dedupe(flattened.unknown.filter((name) => !fieldsByName.has(name))),
    })
  }
  return { objects, warnings: meaningful.filter((w) => w.ignoredKeys.length > 0 || w.unknownFields.length > 0) }
}

/** Apply the merged suffix map (with defaults + row fallback) to one object. */
function applyParams(
  obj: EditorObject,
  name: string,
  field: DesignField,
  suffixMap: Partial<Record<FieldSuffix, DynamicFieldValue>>,
) {
  const primary = primarySuffix(field)
  for (const suffix of VALUE_SUFFIXES) {
    const raw = suffixMap[suffix]
    // A bare row value only fills the field's primary property; applying it to
    // every suffix turned text into image/font/visibility values.
    const fromRow = suffixMap.row !== undefined && suffix === primary
    const value = (raw ?? (fromRow ? (suffixMap.row as DynamicFieldValue) : undefined)) ?? defaultFor(field, suffix)
    if (value === undefined) continue
    applySuffix(obj, suffix, coerce(suffix, value as DynamicFieldValue))
  }
}

/** The default property this field writes for row-shape callers. */
function targetProperty(field: DesignField, _name: string, _suffix: FieldSuffix): FieldSuffix | undefined {
  const target = field.targets[0]
  return target?.property
}

function primarySuffix(field: DesignField): FieldSuffix {
  const target = field.targets[0]
  return target?.property ?? 'text'
}

function defaultFor(field: DesignField, suffix: FieldSuffix): DynamicFieldValue | undefined {
  return field.default?.[suffix]
}

export function applySuffix(obj: EditorObject, suffix: FieldSuffix, value: DynamicFieldValue) {
  switch (suffix) {
    case 'text': {
      if (typeof obj.text === 'string' || obj.type === 'textbox') obj.text = String(value).replace(/\r\n?/g, '\n')
      break
    }
    case 'image_url':
      if (String(obj.type ?? '').toLowerCase() === 'image') obj.src = String(value)
      break
    case 'video_url':
      if (typeof obj.videoSrc !== 'undefined') obj.videoSrc = String(value)
      else if (String(obj.type ?? '').toLowerCase() === 'image') obj.src = String(value)
      break
    case 'color':
      obj.fill = String(value)
      break
    case 'font_family':
      obj.fontFamily = String(value)
      break
    case 'font_size':
      obj.fontSize = Number(value)
      break
    case 'visible':
      obj.visible = Boolean(value)
      break
  }
}

function findObjects(doc: ImageEditorDocument, objectId: string): EditorObject[] {
  const found: EditorObject[] = []
  for (const page of doc.pages) collectObjectsDeep(page.objects, objectId, found)
  return found
}

function collectObjectsDeep(objects: EditorObject[], objectId: string, found: EditorObject[]): void {
  for (const obj of objects) {
    if (obj.id === objectId) found.push(obj)
    if (Array.isArray(obj.objects)) collectObjectsDeep(obj.objects as EditorObject[], objectId, found)
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)]
}
