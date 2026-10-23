/**
 * YouTube metadata fallbacks.
 *
 * API-key (and any non-UI) post creation does not send `platformSettings`, so
 * YouTube uploads used to land as "Untitled Video" with no tags. These helpers
 * derive both from the post content — deterministically, with no AI call — and
 * clamp them to YouTube's hard limits so an oversized caption cannot fail the
 * whole upload.
 */

export const YOUTUBE_TITLE_MAX = 100
export const YOUTUBE_DESCRIPTION_MAX = 5000
export const YOUTUBE_TAG_MAX = 30
export const YOUTUBE_TAGS_TOTAL_MAX = 500
export const YOUTUBE_MAX_TAGS = 5

const TAG_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before',
  'being', 'but', 'can', 'could', 'did', 'does', 'doing', 'for', 'from', 'had',
  'has', 'have', 'here', 'how', 'into', 'its', 'just', 'like', 'more', 'most',
  'not', 'now', 'off', 'once', 'only', 'other', 'our', 'out', 'over', 'own',
  'same', 'she', 'should', 'some', 'such', 'than', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'too',
  'under', 'until', 'very', 'was', 'were', 'what', 'when', 'where', 'which',
  'while', 'who', 'why', 'will', 'with', 'would', 'you', 'your', 'yours',
  'video', 'shorts', 'short', 'watch', 'subscribe', 'follow',
])

/** Strip links, @handles and #hashtags from a candidate title line. */
function cleanTitleLine(line: string): string {
  return line
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[@#]\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The first meaningful content line becomes the title when none was given. */
export function deriveTitle(content: string): string {
  const firstLine = content.split('\n').map(line => cleanTitleLine(line)).find(Boolean) ?? ''
  return firstLine.slice(0, YOUTUBE_TITLE_MAX).trim() || 'Untitled Video'
}

/** Explicit tags win; derive #hashtags then significant words otherwise. */
export function deriveTags(content: string, title: string): string[] {
  const hashtags = [...content.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(match => match[1] as string)
  const words = `${title} ${content}`.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []
  const candidates = [...hashtags, ...words.filter(word => !TAG_STOPWORDS.has(word))]
  return [...new Set(candidates.map(tag => tag.toLowerCase()))]
}

/** Accepts `['a','b']` or `'a, b'`; strips a leading `#` and de-duplicates. */
export function normalizeTags(input: string[] | string | undefined): string[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : input.split(',')
  const cleaned = list.map(tag => String(tag).trim().replace(/^#/, '')).filter(Boolean)
  return [...new Set(cleaned)]
}

export function resolveTitle(explicit: string | undefined, fallback: string | undefined, content: string): string {
  const candidate = explicit?.trim() || fallback?.trim()
  return candidate ? candidate.slice(0, YOUTUBE_TITLE_MAX) : deriveTitle(content)
}

export function resolveTags(settingsTags: string[] | string | undefined, content: string, title: string): string[] {
  const explicit = normalizeTags(settingsTags)
  const tags = explicit.length > 0 ? explicit : deriveTags(content, title)

  const limited: string[] = []
  let total = 0
  for (const tag of tags) {
    const value = tag.slice(0, YOUTUBE_TAG_MAX)
    const fits = value.length > 0 && total + value.length + 1 <= YOUTUBE_TAGS_TOTAL_MAX
    if (!fits) continue
    total += value.length + 1
    limited.push(value)
    if (limited.length >= YOUTUBE_MAX_TAGS) break
  }
  return limited
}

export function resolveDescription(content: string): string {
  return (content || '').slice(0, YOUTUBE_DESCRIPTION_MAX)
}
