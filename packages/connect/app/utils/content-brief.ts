/**
 * A brief is prose (PRD-CONTENT-PIPELINE-OVERHAUL §10.1 rule 4). A model that
 * answers with a JSON envelope is unwrapped out of it; a brief that still looks
 * like an envelope after that is dropped, so the card renders nothing rather
 * than a fragment of `{ "brief": "Ten checks a homeown…`.
 *
 * This is the client half of the rule — a sanitiser also runs server-side, and
 * this one exists so a card cannot show JSON even for an item stored before that
 * landed. Invariant: `displayAngle` never returns a string containing a brace or
 * a bracket, which is what §10.2 asserts about a rendered brief.
 */

/** Keys an envelope may hide the prose behind, most specific first. */
const BRIEF_KEYS = ['brief', 'summary', 'angle', 'title']

/** Fenced JSON is still JSON. */
const FENCE = /^```[a-z]*\s*|\s*```$/gi

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Anything carrying a brace or a bracket is envelope-shaped, not prose. */
function looksLikeEnvelope(text: string): boolean {
  return /[[\]{}]/.test(text)
}

function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  }
  catch {
    return null
  }
}

function proseFromRecord(record: Record<string, unknown>): string {
  for (const key of BRIEF_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

/** Bounded unwrap: at most three levels, so a self-referential blob terminates. */
function unwrap(text: string, depth: number): string {
  if (depth > 2) return ''
  const flat = collapse(text.replace(FENCE, ''))
  if (!flat) return ''
  if (!looksLikeEnvelope(flat)) return flat
  return unwrap(proseFromRecord(parseRecord(flat) ?? {}), depth + 1)
}

/**
 * The angle a card renders: trimmed, whitespace-collapsed, unwrapped out of a
 * JSON envelope, and `''` when nothing usable is left. Never a JSON fragment.
 */
export function displayAngle(text: string | null | undefined): string {
  return unwrap(text ?? '', 0)
}