import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { extractJsonObject } from '../utils/run-config'
import type { ChainContext } from './content-chain.service'
import type { ContentCheck, ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { contentScoreInstructions, contentScoreRubric } from '../flue/skills'
import { scoreArticleWithRules } from './article-scoring'

/**
 * Agent-driven content scoring (PRD-CONTENT-PIPELINE-OVERHAUL, owner request
 * 2026-10-02: "for the content scoring is not better have a skill for the
 * agent ... it can be extended and easily edited by me").
 *
 * The rubric lives in `server/agent/skills/content-score/` as a SKILL.md plus
 * an editable `references/scoring-rubric.md`. No point value or band is
 * hardcoded here — the owner retunes scoring by editing that one document.
 *
 * The deterministic rules in `article-scoring.ts` remain as a labelled
 * FALLBACK for when the model cannot answer. A scoring failure must never
 * silently become a zero, so every check records which scorer produced it.
 */

export type ScoredBar = 'seo' | 'geo' | 'links'

const BAR_KINDS: Record<ScoredBar, ContentCheck['kind']> = {
  seo: 'seo',
  geo: 'geo',
  links: 'links',
}

const STATUS_BANDS: Record<ScoredBar, [number, number]> = {
  // pass >= , warn >=  — mirrors references/scoring-rubric.md
  seo: [75, 50],
  geo: [70, 45],
  links: [100, 1],
}

const STATUS_VALUES = ['pass', 'warn', 'fail'] as const
type CheckStatus = (typeof STATUS_VALUES)[number]

interface BarResult {
  score: number
  status: CheckStatus
  findings: Record<string, unknown>
}

export interface SkillScoreInput {
  itemId: string
  /** The text to score — the article body when present, else the caption. */
  text: string
  /** Which of the two it was, so the UI can say so. */
  measured: 'article' | 'caption'
  brief: string
  topic?: string
  keyword?: string
  /** Real HTTP probe results. `blocked` must never be scored as a failure. */
  linkProbes: Array<{ url: string, status: 'ok' | 'unreachable' | 'blocked' }>
}

function clampScore(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
  return Math.min(100, Math.max(0, numeric))
}

function bandStatus(bar: ScoredBar, score: number): CheckStatus {
  const [passAt, warnAt] = STATUS_BANDS[bar]
  if (score >= passAt) return 'pass'
  return score >= warnAt ? 'warn' : 'fail'
}

/** Accept the model's status only when it is one of the three real values. */
function readStatus(raw: unknown, bar: ScoredBar, score: number): CheckStatus {
  return STATUS_VALUES.includes(raw as CheckStatus) ? raw as CheckStatus : bandStatus(bar, score)
}

function readFindings(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
}

function readBar(parsed: Record<string, unknown>, bar: ScoredBar): BarResult | null {
  const raw = parsed[bar]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const score = clampScore(record.score)
  return { score, status: readStatus(record.status, bar, score), findings: readFindings(record.findings) }
}

/** True only when all three bars came back well-formed — never trust a partial. */
function completeResult(parsed: Record<string, unknown>): Record<ScoredBar, BarResult> | null {
  const seo = readBar(parsed, 'seo')
  const geo = readBar(parsed, 'geo')
  const links = readBar(parsed, 'links')
  if (!seo || !geo || !links) return null
  return { seo, geo, links }
}

function promptFor(input: SkillScoreInput): string {
  return [
    'Score this content. Read the rubric first — it is the authority.',
    '',
    `text (${input.measured}):`,
    '"""',
    input.text,
    '"""',
    '',
    'brief:',
    '"""',
    input.brief,
    '"""',
    '',
    `topic: ${input.topic || '(none given)'}`,
    `keyword: ${input.keyword || '(none given)'}`,
    '',
    'linkProbes:',
    JSON.stringify(input.linkProbes),
    '',
    'Return strict JSON only, no prose, no code fences.',
  ].join('\n')
}

/**
 * Score through the `content-score` skill. Falls back to the deterministic
 * rules when the model cannot answer or answers something unusable, and says
 * which scorer produced each number so the UI never presents a fallback as if
 * it were the rubric.
 */
export async function scoreArticleWithSkill(
  ctx: ChainContext,
  input: SkillScoreInput,
): Promise<Record<ScoredBar, BarResult> & { scoredBy: 'skill' | 'rules', notes?: string }> {
  const fallback = scoreArticleWithRules(input)
  const rubric = contentScoreRubric()
  let parsed: Record<string, unknown> | null = null
  try {
    const raw = await ctx.complete({
      system: contentScoreInstructions(),
      prompt: `${rubric}\n\n${promptFor(input)}`,
      maxTokens: 1800,
    })
    parsed = extractJsonObject(raw) as Record<string, unknown> | null
  }
  catch {
    parsed = null
  }
  const scored = parsed ? completeResult(parsed) : null
  if (!scored) return { ...fallback, scoredBy: 'rules' }
  const notes = typeof parsed?.notes === 'string' ? parsed.notes : undefined
  return { ...scored, scoredBy: 'skill', ...(notes ? { notes } : {}) }
}

export interface RecordableCheck {
  kind: ContentCheck['kind']
  status: CheckStatus
  score: number
  findings: Record<string, unknown>
}

/** Turn one scored bar into the three checks to persist. */
export function checksFromScore(score: Record<ScoredBar, BarResult> & { scoredBy?: string, notes?: string }): RecordableCheck[] {
  return (Object.keys(BAR_KINDS) as ScoredBar[]).map((bar) => ({
    kind: BAR_KINDS[bar],
    status: score[bar].status,
    score: score[bar].score,
    findings: { ...score[bar].findings, scoredBy: score.scoredBy ?? 'rules' },
  }))
}

/** Persist the three checks. `recordCheck` replaces per (itemId, kind). */
export async function recordScoredChecks(
  ctx: ChainContext,
  itemId: string,
  checks: RecordableCheck[],
): Promise<ServiceResponse<ContentCheck[]>> {
  const recorded: ContentCheck[] = []
  for (const check of checks) {
    const result = await contentBoardService.recordCheck(
      ctx.userId,
      ctx.businessId,
      itemId,
      { kind: check.kind, status: check.status, score: check.score, findings: check.findings },
      ctx.event,
    )
    if (result.success) recorded.push(result.data)
  }
  return { success: true, data: recorded }
}
