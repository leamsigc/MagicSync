const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /xox[bpas]-[A-Za-z0-9-]+/g,
  // The optional quote before the separator covers JSON payloads, where a token
  // reads accessToken":"value" rather than access_token=value.
  /(api[_-]?key|secret|password|passwd|pwd|token|bearer)['"]?\s*[:=]\s*['"]?[^\s'";,}]+/gi,
]

/**
 * Strips credential-shaped values out of a free-text string.
 *
 * This is a last line of defence at a boundary, not a parser. It cannot tell a
 * real token from a harmless identifier, so it deliberately over-matches: an
 * audit row that says `access_[REDACTED]` is still worth reading, whereas a row
 * containing a live OAuth token is a breach.
 *
 * Callers are responsible for not putting secrets in the first place. This
 * exists so that a single careless caller cannot write one to durable storage.
 */
export function redactSecrets(text: string): string {
  let out = text
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0
    out = out.replace(pattern, '[REDACTED]')
  }
  return out
}