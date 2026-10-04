/**
 * SEO audit helpers for the content editor (PRD-CONTENT-PIPELINE-OVERHAUL T07).
 * Pure functions — no DOM or network access — so they run in the Comark
 * plugin context and in the editor sidebar alike.
 */

export interface SeoFindings {
  wordCount: number
  readabilityScore: number
  focusKeywords: string[]
  headingCount: number
  score: number
  issues: string[]
}

export interface OgMetadata {
  title: string
  description: string
  ogType: string
}

/** Flesch-style reading ease clamped to 0-100 (higher = easier). */
export function calculateReadabilityScore(text: string): number {
  const sentences = text.split(/[.!?]+\s|\n+/).filter(sentence => sentence.trim().length > 0)
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0 || sentences.length === 0) return 0
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0)
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
  return Math.round(Math.min(100, Math.max(0, score)))
}

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return 0
  const groups = clean.match(/[aeiouy]+/g)
  let count = groups ? groups.length : 1
  if (clean.endsWith('e') && count > 1) count -= 1
  return count
}

/** Top non-stopword terms by frequency, up to `limit`. */
export function extractFocusKeywords(text: string, limit = 5): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'to', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'as', 'it', 'its',
    'this', 'that', 'these', 'those', 'you', 'your', 'we', 'our', 'they', 'their',
    'will', 'can', 'how', 'what', 'why', 'when', 'not', 'no', 'yes', 'do', 'does',
  ])
  const counts = new Map<string, number>()
  for (const raw of text.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ'-]{2,}/g) ?? []) {
    if (stopWords.has(raw)) continue
    counts.set(raw, (counts.get(raw) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

/** 0-100 audit score from the parsed document findings. */
export function generateSeoScore(findings: {
  wordCount: number
  readabilityScore: number
  focusKeywords: string[]
  headingCount: number
}): { score: number, issues: string[] } {
  const issues: string[] = []
  let score = 100
  if (findings.wordCount < 150) {
    score -= 25
    issues.push('content_short')
  }
  if (findings.readabilityScore < 40) {
    score -= 15
    issues.push('hard_to_read')
  }
  if (findings.headingCount < 2) {
    score -= 15
    issues.push('few_headings')
  }
  if (findings.focusKeywords.length < 3) {
    score -= 10
    issues.push('thin_vocabulary')
  }
  return { score: Math.max(0, score), issues }
}

/** OpenGraph preview metadata derived from the item and its findings. */
export function buildOgMetadata(item: { title: string, brief?: string | null }, findings: SeoFindings): OgMetadata {
  const descriptionSource = item.brief?.trim() || findings.focusKeywords.join(', ')
  return {
    title: item.title,
    description: descriptionSource.slice(0, 160),
    ogType: 'article',
  }
}

/** Parse a markdown document into the raw findings used by the plugin. */
export function parseMarkdownFindings(markdown: string): SeoFindings {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '')
  const headings = withoutCode.match(/^#{1,6}\s.+$/gm) ?? []
  const bodyText = withoutCode
    .replace(/^#{1,6}\s.+$/gm, '')
    .replace(/[*_>`[\]()#-]/g, ' ')
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length
  const readabilityScore = calculateReadabilityScore(bodyText)
  const focusKeywords = extractFocusKeywords(bodyText)
  const { score, issues } = generateSeoScore({ wordCount, readabilityScore, focusKeywords, headingCount: headings.length })
  return { wordCount, readabilityScore, focusKeywords, headingCount: headings.length, score, issues }
}
