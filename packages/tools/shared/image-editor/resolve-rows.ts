import { normalizeDocument, type NormalizeInput } from './normalize'
import type { ImageEditorDocument } from './document'
import type { DynamicFieldValue, FieldValues } from './bind-fields'

/**
 * Row/cartesian resolution — turns caller-provided tables into one bound
 * render per row. Rows always arrive from the caller (CSV upload, JSON body,
 * MCP args); a template_id is resolved by the service layer before this runs.
 */

export const MAX_ROWS = 50
export const MAX_CARTESIAN = 100
export const DOCUMENT_SCHEMA = 'magicsync/image-editor@1'

export interface BatchRowRequest {
  template?: unknown
  document?: unknown
  rows?: Record<string, unknown>[]
  values?: Record<string, unknown[]>
  advanced?: FieldValues[]
}

export interface ResolvedBatch {
  document: ImageEditorDocument
  renders: FieldValues[]
  mode: 'rows' | 'cartesian'
}

export class BatchLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BatchLimitError'
  }
}

export function isDocument(value: unknown): value is ImageEditorDocument {
  const doc = value as ImageEditorDocument
  return Boolean(
    doc && typeof doc === 'object' && doc.schema === DOCUMENT_SCHEMA && Array.isArray(doc.pages) && Array.isArray(doc.fields),
  )
}

function coerceRow(row: Record<string, unknown>): Record<string, DynamicFieldValue> {
  const out: Record<string, DynamicFieldValue> = {}
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}

function cartesian(values: Record<string, unknown[]>): Record<string, DynamicFieldValue>[] {
  const entries = Object.entries(values)
    .map(([name, list]) => ({
      name,
      list: (list ?? []).filter((value): value is DynamicFieldValue =>
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'),
    }))
    .filter(({ name, list }) => name.length > 0 && list.length > 0)

  let combos: Record<string, DynamicFieldValue>[] = [{}]
  for (const { name, list } of entries) {
    combos = combos.flatMap((combo) => list.map((value) => ({ ...combo, [name]: value })))
    if (combos.length > MAX_CARTESIAN) {
      throw new BatchLimitError(`Cartesian combinations exceed the ${MAX_CARTESIAN} limit (currently ${combos.length})`)
    }
  }
  return combos.filter((combo) => Object.keys(combo).length > 0)
}

export function resolveBatch(request: BatchRowRequest): ResolvedBatch {
  const document = isDocument(request.document) ? request.document : normalizeDocument({ json: request.template } satisfies NormalizeInput).document

  const renders: FieldValues[] = []
  if (request.values && Object.keys(request.values).length > 0) {
    for (const combo of cartesian(request.values)) {
      renders.push({ row: combo, ...(request.advanced?.[renders.length] ?? {}) })
    }
  } else if (Array.isArray(request.rows)) {
    if (request.rows.length > MAX_ROWS) {
      throw new BatchLimitError(`Row count ${request.rows.length} exceeds the ${MAX_ROWS} sync limit`)
    }
    for (const [index, raw] of request.rows.map(coerceRow).entries()) {
      if (Object.keys(raw).length === 0) continue
      renders.push({ row: raw, ...(request.advanced?.[index] ?? {}) })
    }
  }

  if (renders.length === 0) throw new BatchLimitError('No rows or values provided')
  return { document, renders, mode: request.values ? 'cartesian' : 'rows' }
}
