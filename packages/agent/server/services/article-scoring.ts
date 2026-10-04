/**
 * Deterministic fallback scoring.
 *
 * The AUTHORITATIVE scorer is the `content-score` agent skill
 * (`server/agent/skills/content-score/`), whose rubric is an editable markdown
 * document. These rules exist for one reason: when the model cannot answer, a
 * scoring failure must never silently become a zero. They mirror the rubric as
 * closely as code allows and every check records which scorer produced it.
 *
 * If you change a number here, change `references/scoring-rubric.md` too.
 */

export interface LinkProbe {
  url: string
  ok: boolean
  status?: number
  reason?: string
}

/** Local rather than imported: `content-chain.service.ts` needs this module. */
function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s)\]"']+/g) ?? []
}

export interface FallbackInput {
  text: string
  measured: 'article' | 'caption'
  /** Sources the brief carried — a brief source counts as a citation. */
  sources: Array<{ label: string, url?: string }>
  topic?: string
  /** Caption drafts keep their own CTA field; an article's CTA must be in the text. */
  captionCta: string
  linkProbes: LinkProbe[]
}

export interface BarScore {
  score: number
  status: 'pass' | 'warn' | 'fail'
  findings: Record<string, unknown>
}

/** 1,200–2,400 characters; ~2,050 is the good target (rubric §SEO). */
const ARTICLE_LENGTH = { min: 1200, max: 2400 }
const CAPTION_LENGTH = { min: 80, max: 220 }
const ARTICLE_MIN_HEADINGS = 2
const SEO_PASS = 75
const SEO_WARN = 50
const GEO_PASS = 70
const GEO_WARN = 45

const CALL_TO_ACTION = /\b(call|book|contact|reach|subscribe|sign up|get started|learn more|read more|check|visit|try|start|download|request|schedule|dm|message)\b/i

function inRange(length: number, range: { min: number, max: number }): boolean {
  return length >= range.min && length <= range.max
}

function topicMentioned(text: string, topic?: string): boolean {
  return topic ? text.toLowerCase().includes(topic.toLowerCase()) : false
}

function questionLed(text: string): boolean {
  const opening = text.trim().replace(/^#{1,6}\s*/, '').split(/[.!?]/)[0] ?? ''
  return opening.endsWith('?') || /^(how|what|why|when|which|who)\b/i.test(opening)
}

function hasCitation(text: string, sources: FallbackInput['sources']): boolean {
  return sources.length > 0 || extractUrls(text).length > 0
}

function hasCta(text: string): boolean {
  return CALL_TO_ACTION.test(text)
}

interface Rule { points: number, miss?: { key: string, value: unknown } }

function rule(ok: boolean, points: number, key: string, value: unknown = true): Rule {
  return ok ? { points } : { points, miss: { key, value } }
}

function applyRules(rules: Rule[], measured: string, pass: number, warn: number): BarScore {
  const findings: Record<string, unknown> = { measured }
  let score = 0
  for (const entry of rules) {
    if (entry.miss) findings[entry.miss.key] = entry.miss.value
    else score += entry.points
  }
  return { score, status: score >= pass ? 'pass' : score >= warn ? 'warn' : 'fail', findings }
}

function seoRules(input: FallbackInput): Rule[] {
  const { text, topic, sources } = input
  const captionsOnly = input.measured === 'caption'
  if (captionsOnly) {
    const hashtags = (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length
    return [
      rule(inRange(text.length, CAPTION_LENGTH), 30, 'length', text.length),
      rule(Boolean(input.captionCta), 20, 'missingCta'),
      rule(hashtags <= 5, 20, 'tooManyHashtags', hashtags),
      rule(topicMentioned(text, topic), 30, 'topicMissing', topic ?? null),
    ]
  }
  const headings = (text.match(/^##\s+\S/gm) ?? []).length
  return [
    rule(inRange(text.length, ARTICLE_LENGTH), 30, 'length', text.length),
    rule(topicMentioned(text, topic), 30, 'topicMissing', topic ?? null),
    rule(hasCta(text), 20, 'missingCta'),
    rule(headings >= ARTICLE_MIN_HEADINGS, 20, 'fewHeadings', headings),
  ]
}

function geoRules(input: FallbackInput): Rule[] {
  const { text, sources, measured } = input
  // An article's CTA must live in the body; a caption's may sit in its own field.
  const cta = measured === 'article' ? hasCta(text) : Boolean(input.captionCta)
  const cited = measured === 'article' ? hasCitation(text, sources) : sources.length > 0
  return [
    rule(questionLed(text), 25, 'notQuestionLed'),
    rule(/\d/.test(text), 25, 'noConcreteData'),
    rule(cited, 25, 'noCitations'),
    rule(cta, 25, 'missingCta'),
  ]
}

/** `blocked` = our own SSRF probe refused the URL. Never the author's defect. */
function linkScore(probes: LinkProbe[]): BarScore {
  const checkable = probes.filter(probe => probe.reason !== 'blocked')
  const skipped = probes.filter(probe => probe.reason === 'blocked')
  const unreachable = checkable.filter(probe => !probe.ok).map(probe => probe.url)
  const findings: Record<string, unknown> = {
    urls: probes.map(probe => probe.url),
    probes: checkable,
    skipped,
  }
  if (unreachable.length > 0) findings.unreachableUrls = unreachable
  // Nothing checkable means nothing broken — an uncited article passes links.
  if (unreachable.length === 0) return { score: 100, status: 'pass', findings }
  const reached = checkable.length - unreachable.length
  const score = Math.round((reached / checkable.length) * 100)
  return { score, status: reached > 0 ? 'warn' : 'fail', findings }
}

/** The three bars from the deterministic rules. */
export function scoreArticleWithRules(input: FallbackInput): {
  seo: BarScore
  geo: BarScore
  links: BarScore
} {
  return {
    seo: applyRules(seoRules(input), input.measured, SEO_PASS, SEO_WARN),
    geo: applyRules(geoRules(input), input.measured, GEO_PASS, GEO_WARN),
    links: linkScore(input.linkProbes),
  }
}
