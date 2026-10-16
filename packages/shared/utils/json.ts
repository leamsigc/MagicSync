/**
 * Safe JSON boundary helpers for DB JSON columns and API payloads.
 *
 * Drizzle `text({ mode: 'json' })` columns arrive as parsed objects while
 * plain `text()` columns arrive as strings, so call sites must handle both.
 * These helpers centralize that normalization: parse once, validate the
 * shape with a runtime guard, fall back otherwise. No chained assertions.
 */

/** Coerce a DB JSON column (string | parsed value | null) to a JSON string. */
export function toJsonString(value: unknown, fallback = '{}'): string {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  try {
    return JSON.stringify(value)
  } catch {
    return fallback
  }
}

/** Parse a JSON string into a plain object, falling back on any failure. */
export function parseJsonObject(raw: string, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return fallback
  } catch {
    return fallback
  }
}

/** Parse a JSON string into an array, falling back on any failure. */
export function parseJsonArray<T>(raw: string, fallback: T[] = []): T[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as T[]
    return fallback
  } catch {
    return fallback
  }
}

/** A run of `{ "0": "{", "1": "\"", ... }` needs at least two characters to be JSON. */
const CHAR_INDEXED_MIN_KEYS = 2

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A string spread into an object produces digit keys holding one character each
 * (`{ ...someString }`). Detect that exact shape so it can be rebuilt.
 */
function isCharIndexed(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record)
  if (keys.length < CHAR_INDEXED_MIN_KEYS) return false
  return keys.every((key, index) => key === String(index) && typeof record[key] === 'string')
}

function decodeCharIndexed(record: Record<string, unknown>): Record<string, unknown> | null {
  if (!isCharIndexed(record)) return null
  const joined = Object.keys(record)
    .sort((a, b) => Number(a) - Number(b))
    .map(key => record[key] as string)
    .join('')
  try {
    const parsed: unknown = JSON.parse(joined)
    return isPlainRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Coerce any DB JSON boundary value into a plain object.
 *
 * Handles the four shapes `entity_details.details` accumulated in the wild:
 * a parsed object, a single-encoded string, a double-encoded string, and the
 * character-indexed object left by `{ ...someString }`. Recurses until it lands
 * on a plain object or the fallback, so reads never surface a corrupt shape.
 */
export function coerceJsonObject(value: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (isPlainRecord(value)) {
    return decodeCharIndexed(value) ?? value
  }
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return coerceJsonObject(JSON.parse(value), fallback)
  } catch {
    return fallback
  }
}
