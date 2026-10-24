import { safeFetch } from './ssrf'

export interface FetchedPage {
  url: string
  content: string
}

export function stripHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * SSRF-safe public page fetch for research flows. Never throws: unsafe,
 * unreachable, or empty pages resolve to null so callers can degrade to
 * LLM-only output instead of failing the whole run.
 *
 * `safeFetch` pins the resolved IP and re-validates every redirect hop, so a
 * public URL that 302s to an internal address is rejected.
 */
export async function scrapePublicPage(url: string, maxChars = 8000): Promise<FetchedPage | null> {
  try {
    const response = await safeFetch(url, {
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 10_000,
      headers: { 'user-agent': 'MagicSyncBot/1.0 (+https://magicsync.dev)' },
    })
    if (response.status < 200 || response.status >= 300) return null
    const content = stripHtmlText(response.body.toString('utf8').slice(0, 20_000)).slice(0, maxChars)
    return content ? { url, content } : null
  }
  catch {
    return null
  }
}
