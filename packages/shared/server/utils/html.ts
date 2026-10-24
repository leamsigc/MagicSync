/**
 * Minimal HTML escaping for server-rendered snippets that are returned as
 * `text/html` or injected into a document. Every value that originates from a
 * third party (OAuth profile, Google review, social post) must pass through
 * this before it touches a template string — string concatenation is how XSS
 * gets in, escaping is how it stays out.
 */
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char] ?? char)
}

/**
 * Only allow https image URLs from an allowlist of hosts; anything else is
 * dropped. Used for avatars that end up inside an `src="..."` attribute.
 */
export function safeImageUrl(value: unknown, allowedHostSuffixes: string[]): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password) return null
    const host = parsed.hostname.toLowerCase()
    const allowed = allowedHostSuffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`))
    return allowed ? parsed.toString() : null
  }
  catch {
    return null
  }
}
