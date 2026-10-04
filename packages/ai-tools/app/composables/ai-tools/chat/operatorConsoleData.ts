/**
 * Pure helpers behind the operator console (PRD §1.3). Every one of them turns a
 * stored row into something a business owner can read: a `ServiceResponse`
 * envelope is unwrapped, a run row becomes a sentence, and an artifact becomes
 * a title plus a derived kind. No framework, no i18n, no fetch — the values
 * that reach a template are always keys, never internal names.
 */

export interface OperatorArtifactRow {
  id: string
  kind: string
  status: string
  version: number
  output: string | Record<string, unknown>
  updatedAt: string
}

export interface OperatorApprovalRecordRow {
  id: string
  artifactId: string
  version: number
}

export interface OperatorRunRow {
  id: string
  agentName: string
  status: string
  summary: string
  startedAt: string
}

export interface AwaitingApproval {
  id: string
  version: number
  kindKey: string
  preview: string
  at: string
}

export type ActivityTone = 'idle' | 'success' | 'error'

export interface OperatorActivityItem {
  id: string
  phraseKey: string
  detail: string
  tone: ActivityTone
  at: string
  /** The run's own status; only a running run can still be stopped. */
  status: string
}

export interface RelativeTime {
  key: string
  count: number
}

/** Per-model-call telemetry rows. Never a user-visible action. */
const INTERNAL_RUN_PREFIX = 'ai.call:'

const AWAITING_STATUSES = new Set(['review_required', 'changes_requested'])
const TITLE_KEYS = ['title', 'headline', 'subject']
const BODY_KEYS = ['article', 'caption', 'content', 'markdown']
const PREVIEW_LIMIT = 180

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const KIND_KEYS: Record<string, string> = {
  social_post: 'socialPost',
  carousel: 'carousel',
  reel_storyboard: 'reel',
  research: 'research',
  template: 'template',
  github_article: 'githubArticle',
  wordpress_article: 'wordpressArticle',
}

const RUN_PHRASES: Record<string, string> = {
  MagicSyncAgent: 'plans',
  researcher: 'researched',
  writer: 'drafted',
  humanizer: 'polished',
  'trend-scout': 'trends',
}

const STATUS_PHRASES: Record<string, string> = {
  running: 'working',
  failed: 'didNotFinish',
  cancelled: 'stopped',
}

/** A run is only stoppable while it is still going. */
export function isActiveActivity(item: OperatorActivityItem): boolean {
  return item.status === 'running'
}

const STATUS_TONES: Record<string, ActivityTone> = {
  running: 'idle',
  completed: 'success',
  failed: 'error',
  cancelled: 'idle',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function errorText(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

/**
 * `GET /api/v1/artifacts` and `GET /api/v1/artifacts/approvals` return the raw
 * service envelope, so `data` has to be pulled out by hand. A failed envelope
 * reads as "nothing to show" rather than an exception at the call site.
 */
export function envelopeData<T>(raw: unknown): T | undefined {
  if (!isRecord(raw)) return undefined
  if (raw.success === false) return undefined
  const data = raw.data
  if (isRecord(data) || Array.isArray(data)) return data as T
  return undefined
}

export function unwrapList<T>(raw: unknown): T[] {
  return envelopeData<T[]>(raw) ?? []
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return ''
}

function firstLine(text: string): string {
  const line = text.split('\n').find(candidate => candidate.trim().length > 0)
  return (line ?? '').trim().slice(0, PREVIEW_LIMIT)
}

function parseArtifactOutput(raw: OperatorArtifactRow['output']): Record<string, unknown> {
  if (typeof raw !== 'string') return isRecord(raw) ? raw : {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

/** The line an owner reads on the approval card: its title, else its first line. */
export function artifactPreview(output: OperatorArtifactRow['output']): string {
  const record = parseArtifactOutput(output)
  const title = firstText(record, TITLE_KEYS)
  if (title) return title
  return firstLine(firstText(record, BODY_KEYS))
}

export function artifactKindKey(kind: string): string {
  return KIND_KEYS[kind] ?? 'draft'
}

/**
 * What is still waiting for a decision: an artifact the writer parked for
 * review, minus any version that already carries a recorded decision.
 */
export function awaitingArtifacts(
  rows: OperatorArtifactRow[],
  records: OperatorApprovalRecordRow[],
): AwaitingApproval[] {
  const decided = new Set(records.map(record => `${record.artifactId}:${record.version}`))
  return rows
    .filter(row => AWAITING_STATUSES.has(row.status))
    .filter(row => !decided.has(`${row.id}:${row.version}`))
    .map(row => ({
      id: row.id,
      version: row.version,
      kindKey: artifactKindKey(row.kind),
      preview: artifactPreview(row.output),
      at: row.updatedAt,
    }))
}

function phraseForRun(run: OperatorRunRow): string {
  if (run.agentName.startsWith('topic-batch:')) return 'ideas'
  return STATUS_PHRASES[run.status] ?? RUN_PHRASES[run.agentName] ?? 'worked'
}

/**
 * One run, one sentence. `agentName`, `status` and the stored summary never
 * reach the template: the name becomes a phrase key, the status becomes a tone,
 * and the summary is only echoed when the run actually finished.
 */
export function runActivityItem(run: OperatorRunRow): OperatorActivityItem | null {
  if (run.agentName.startsWith(INTERNAL_RUN_PREFIX)) return null
  return {
    id: run.id,
    phraseKey: phraseForRun(run),
    detail: run.status === 'completed' ? firstLine(run.summary) : '',
    tone: STATUS_TONES[run.status] ?? 'idle',
    at: run.startedAt,
    status: run.status,
  }
}

function newestFirst(a: OperatorActivityItem, b: OperatorActivityItem): number {
  return new Date(b.at).getTime() - new Date(a.at).getTime()
}

export function buildActivity(runs: OperatorRunRow[]): OperatorActivityItem[] {
  return runs
    .map(runActivityItem)
    .filter((item): item is OperatorActivityItem => item !== null)
    .sort(newestFirst)
}

/** Relative age as a key plus a count, so the copy stays translatable. */
export function relativeTime(at: string, now: number): RelativeTime {
  const stamp = new Date(at).getTime()
  if (Number.isNaN(stamp)) return { key: 'justNow', count: 0 }
  const elapsed = Math.max(0, now - stamp)
  if (elapsed < MINUTE_MS) return { key: 'justNow', count: 0 }
  if (elapsed < HOUR_MS) return { key: 'minutes', count: Math.floor(elapsed / MINUTE_MS) }
  if (elapsed < DAY_MS) return { key: 'hours', count: Math.floor(elapsed / HOUR_MS) }
  return { key: 'days', count: Math.floor(elapsed / DAY_MS) }
}
