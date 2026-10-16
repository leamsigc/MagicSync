import type { AdminColumnMeta } from '#layers/BaseDB/server/services/admin-data.service'


export type AdminFormValue = string | number | boolean | null
export type AdminFormValues = Record<string, AdminFormValue>

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function toStringInput(value: unknown): string {
  if (isBlank(value)) return ''
  return String(value)
}

function toDatetimeInput(value: unknown): AdminFormValue {
  if (isBlank(value)) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function submitDatetime(value: unknown): AdminFormValue {
  if (isBlank(value)) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function submitNumber(value: unknown): AdminFormValue {
  if (isBlank(value)) return null
  return Number(value)
}

function toJsonInput(value: unknown): AdminFormValue {
  if (isBlank(value)) return ''
  return formatAdminJson(value, true)
}

export function formatAdminDatetime(value: unknown): string {
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

/** JSON columns may already be objects (Drizzle json mode) or raw strings. */
export function formatAdminJson(value: unknown, pretty = false): string {
  const spacing = pretty ? 2 : undefined
  if (typeof value !== 'string') return JSON.stringify(value, null, spacing)
  try {
    return JSON.stringify(JSON.parse(value), null, spacing)
  } catch {
    return value
  }
}

const CELL_FORMATTERS: Partial<Record<AdminColumnMeta['type'], (value: unknown) => string>> = {
  boolean: value => (value ? '✓' : '✗'),
  datetime: formatAdminDatetime,
  json: value => formatAdminJson(value),
}

export function formatAdminCellValue(column: AdminColumnMeta, value: unknown): string {
  if (isBlank(value)) return '—'
  const formatter = CELL_FORMATTERS[column.type]
  if (formatter) return formatter(value)
  return String(value)
}

const EDIT_CONVERTERS: Partial<Record<AdminColumnMeta['type'], (value: unknown) => AdminFormValue>> = {
  boolean: value => Boolean(value),
  number: submitNumber,
  datetime: toDatetimeInput,
  json: toJsonInput,
}

export function adminEditValue(column: AdminColumnMeta, value: unknown): AdminFormValue {
  const converter = EDIT_CONVERTERS[column.type]
  if (converter) return converter(value)
  return toStringInput(value)
}

const SUBMIT_CONVERTERS: Partial<Record<AdminColumnMeta['type'], (value: unknown) => AdminFormValue>> = {
  boolean: value => Boolean(value),
  number: submitNumber,
  datetime: submitDatetime,
  json: value => (isBlank(value) ? null : toStringInput(value)),
}

export function adminSubmitValue(column: AdminColumnMeta, value: unknown): AdminFormValue {
  const converter = SUBMIT_CONVERTERS[column.type]
  if (converter) return converter(value)
  return toStringInput(value)
}

export function adminSubmitValues(
  columns: AdminColumnMeta[],
  form: Record<string, unknown>,
): AdminFormValues {
  const values: AdminFormValues = {}
  for (const column of columns) {
    if (!column.editable) continue
    values[column.key] = adminSubmitValue(column, form[column.key])
  }
  return values
}
