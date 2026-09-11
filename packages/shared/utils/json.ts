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
