/**
 * Pure helpers for Auto-Reply (comment-to-DM automation).
 * Zero imports — unit-testable with node:test, no Nuxt context needed.
 */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Unicode-aware keyword matcher. First keyword wins. Returns matched keyword or null. */
export function matchKeywords(text: string, keywords: string[], mode: 'whole' | 'partial'): string | null {
  const hay = (text || '').toLowerCase()
  for (const raw of keywords) {
    const kw = (raw || '').trim().toLowerCase()
    if (!kw) continue
    if (mode === 'partial') {
      if (hay.includes(kw)) return raw.trim()
    } else {
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(kw)}([^\\p{L}\\p{N}_]|$)`, 'iu')
      if (pattern.test(text || '')) return raw.trim()
    }
  }
  return null
}

/** Replace {username}, {link1}, {link2} slots. Unknown slots left untouched. */
export function renderTemplate(tpl: string, vars: { username: string; links: string[] }): string {
  let out = tpl || ''
  out = out.split('{username}').join(vars.username || '')
  out = out.split('{link1}').join(vars.links[0] || '')
  out = out.split('{link2}').join(vars.links[1] || '')
  return out
}

export function trackedUrl(appBaseUrl: string, campaignId: string, linkId: string): string {
  return `${appBaseUrl.replace(/\/$/, '')}/r/${campaignId}/${linkId}`
}

export function isHttpsUrl(target: string): boolean {
  try {
    const u = new URL(target)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

export function hourBucketUtc(date = new Date()): string {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`
}

/** FIFO trim for per-campaign contacted-user cooldown lists. */
export function trimContacted(ids: string[], cap = 2000): string[] {
  if (ids.length <= cap) return ids
  return ids.slice(ids.length - cap)
}
