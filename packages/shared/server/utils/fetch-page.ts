import { isSafeExternalUrl } from './ssrf'

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
 */
export async function scrapePublicPage(url: string, maxChars = 8000): Promise<FetchedPage | null> {
  const safety = await isSafeExternalUrl(url)
  if (!safety.safe) return null
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': 'MagicSyncBot/1.0 (+https://magicsync.dev)' },
    })
    if (!response.ok) return null
    const content = stripHtmlText((await response.text()).slice(0, 20_000)).slice(0, maxChars)
    return content ? { url, content } : null
  }
  catch {
    return null
  }
}
