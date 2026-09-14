/**
 * Structural virality assessment for drafts (no measured metrics).
 * Pure functions shared by the ai-tools check routes and the agent revise
 * flow. Scores are always labelled `heuristic` at the call site — never
 * presented as measured data.
 */

export interface DraftVirality {
  score: number
  tier: string
  strengths: string[]
  suggestions: string[]
  reason: string
  source: 'heuristic'
}

export interface PlatformVirality {
  platform: string
  score: number
  tier: string
  strengths: string[]
  suggestions: string[]
}

export interface SplitArtifact {
  caption: string
  variants: Record<string, string>
}

export interface PlatformFit {
  minChars: number
  maxChars: number
  minTags: number
  maxTags: number
  note: string
}

const PLATFORM_FIT: Record<string, PlatformFit> = {
  instagram: { minChars: 80, maxChars: 2200, minTags: 3, maxTags: 5, note: 'Instagram rewards a fast hook, 3-5 niche hashtags, and a save/share CTA' },
  tiktok: { minChars: 60, maxChars: 300, minTags: 3, maxTags: 4, note: 'TikTok rewards a conversational hook in the first 20 words and a comment CTA' },
  twitter: { minChars: 40, maxChars: 280, minTags: 0, maxTags: 2, note: 'X rewards one hook plus one fact with a CTA inside 280 characters' },
  x: { minChars: 40, maxChars: 280, minTags: 0, maxTags: 2, note: 'X rewards one hook plus one fact with a CTA inside 280 characters' },
  linkedin: { minChars: 300, maxChars: 3000, minTags: 0, maxTags: 3, note: 'LinkedIn rewards question-led, value-first posts with short paragraphs' },
  facebook: { minChars: 100, maxChars: 2000, minTags: 0, maxTags: 2, note: 'Facebook rewards warm mid-length posts with a discussion question' },
  threads: { minChars: 40, maxChars: 500, minTags: 0, maxTags: 2, note: 'Threads rewards short casual posts with at most 2 hashtags' },
  bluesky: { minChars: 40, maxChars: 300, minTags: 0, maxTags: 2, note: 'Bluesky rewards plain language under 300 characters' },
  youtube: { minChars: 100, maxChars: 1000, minTags: 3, maxTags: 5, note: 'YouTube rewards a title-like first line plus a subscribe CTA' },
  reddit: { minChars: 100, maxChars: 2000, minTags: 0, maxTags: 0, note: 'Reddit rewards helpful plain text with no hashtags' },
  wordpress: { minChars: 600, maxChars: 4000, minTags: 0, maxTags: 0, note: 'Blog posts reward depth with sections' },
}

const DEFAULT_FIT: PlatformFit = {
  minChars: 80,
  maxChars: 2000,
  minTags: 1,
  maxTags: 5,
  note: 'General best practice: hook first, focused hashtags, one clear CTA',
}

export function viralityTier(score: number): string {
  if (score >= 80) return 'breakout'
  if (score >= 60) return 'viral'
  if (score >= 40) return 'steady'
  return 'sleeper'
}

function scoreHook(text: string, strengths: string[], suggestions: string[]): number {
  const opening = text.trim().split(/[.!?\n]/)[0] ?? ''
  if (opening.endsWith('?') || /^(how|what|why|when|which|who)\b/i.test(opening)) {
    strengths.push('Question-led hook')
    return 25
  }
  if (/\d/.test(opening)) {
    strengths.push('Number-led hook')
    return 20
  }
  if (opening.endsWith('!')) {
    strengths.push('High-energy hook')
    return 12
  }
  suggestions.push('Open with a question or a concrete number')
  return 8
}

function scoreBody(text: string, strengths: string[], suggestions: string[]): number {
  let score = 0
  if (text.length >= 80 && text.length <= 2000) {
    strengths.push('Healthy length')
    score += 20
  }
  else {
    suggestions.push('Aim for 80+ characters with one clear idea')
  }
  if (/\d/.test(text)) {
    strengths.push('Concrete numbers')
    score += 15
  }
  else {
    suggestions.push('Add a concrete number or proof point')
  }
  if (/(link in bio|comment|share|save this|follow|subscribe|swipe|tap|click|shop|sign up|learn more)/i.test(text)) {
    strengths.push('Clear call to action')
    score += 15
  }
  else {
    suggestions.push('End with one clear call to action')
  }
  return score
}

function scoreTags(text: string, strengths: string[], suggestions: string[]): number {
  const count = (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length
  if (count >= 1 && count <= 5) {
    strengths.push('Focused hashtags')
    return 10
  }
  if (count === 0) suggestions.push('Add 1-5 niche hashtags')
  else suggestions.push('Trim to 5 hashtags max')
  return 5
}

/** Overall structural estimate for one piece of copy. */
export function scoreDraftVirality(text: string): DraftVirality {
  if (!text.trim()) {
    return {
      score: 0,
      tier: 'sleeper',
      strengths: [],
      suggestions: ['Write the draft first'],
      reason: 'Empty draft — nothing to assess',
      source: 'heuristic',
    }
  }
  const strengths: string[] = []
  const suggestions: string[] = []
  const score = Math.min(
    scoreHook(text, strengths, suggestions)
    + scoreBody(text, strengths, suggestions)
    + scoreTags(text, strengths, suggestions),
    100,
  )
  return {
    score,
    tier: viralityTier(score),
    strengths,
    suggestions,
    reason: 'Structural estimate only — no measured metrics yet',
    source: 'heuristic',
  }
}

function fitLength(len: number, fit: PlatformFit, strengths: string[], suggestions: string[]): number {
  if (len >= fit.minChars && len <= fit.maxChars) {
    strengths.push(`Good length for the platform (${len} chars)`)
    return 10
  }
  suggestions.push(fit.note)
  return -10
}

function tagAdvice(fit: PlatformFit, tags: number): string {
  if (fit.maxTags === 0) return 'Drop hashtags on this platform'
  if (tags < fit.minTags) return `Add hashtags (aim ${fit.minTags}-${fit.maxTags})`
  return `Trim to ${fit.maxTags} hashtags max`
}

function fitTags(text: string, fit: PlatformFit, strengths: string[], suggestions: string[]): number {
  const tags = (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length
  if (tags >= fit.minTags && tags <= fit.maxTags) {
    strengths.push('Hashtag count fits the platform')
    return 10
  }
  suggestions.push(tagAdvice(fit, tags))
  return -10
}

/** Per-platform structural estimate for one variant. */
export function scorePlatformVirality(text: string, platform: string): PlatformVirality {
  const base = scoreDraftVirality(text)
  const fit = PLATFORM_FIT[platform.toLowerCase()] ?? DEFAULT_FIT
  const strengths = [...base.strengths]
  const suggestions = [...base.suggestions]
  const score = Math.min(100, Math.max(0,
    base.score
    + fitLength(text.length, fit, strengths, suggestions)
    + fitTags(text, fit, strengths, suggestions),
  ))
  return { platform, score, tier: viralityTier(score), strengths, suggestions }
}

function variantText(variant: unknown): string {
  if (typeof variant === 'string') return variant
  const caption = (variant as { caption?: unknown } | null)?.caption
  return typeof caption === 'string' ? caption : ''
}

function parseOutputRecord(output: unknown): Record<string, unknown> {
  const candidate = typeof output === 'string' ? safeJsonParse(output) : output
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : {}
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  }
  catch {
    return null
  }
}

/** Split a stored artifact output into its main caption and per-platform variant texts. */
export function splitArtifactOutput(output: unknown): SplitArtifact {
  const record = parseOutputRecord(output)
  const caption = typeof record.caption === 'string' ? record.caption : ''
  const variants: Record<string, string> = {}
  const raw = record.platformVariants
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [platform, variant] of Object.entries(raw)) {
      const text = variantText(variant)
      if (text) variants[platform] = text
    }
  }
  return { caption, variants }
}
