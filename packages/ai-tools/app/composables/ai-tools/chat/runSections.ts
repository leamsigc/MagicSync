/**
 * T23 RunCard data helpers (PRD §4.6): group one run's tool calls into
 * presentational sections and derive the step rail from REAL statuses.
 *
 * Pure and framework-free (no Vue imports) so both the card components and
 * `node:test` cover the same logic. The rail prefers the server run/step
 * envelope when present and falls back to tool-call states otherwise — never
 * a faked local phase.
 */

export type SectionKind = 'research' | 'ideas' | 'carousel' | 'image' | 'draft' | 'schedule' | 'board' | 'delivery'
export type RailStatus = 'done' | 'active' | 'todo' | 'failed' | 'running'

export interface ToolCallLike {
  id: string
  name: string
  args?: Record<string, unknown>
  result?: string
  error?: string
}

export interface RailStep {
  id: string
  label: string
  status: RailStatus
}

export interface RunSection {
  kind: SectionKind
  calls: ToolCallLike[]
}

export interface EnvelopeStep {
  id: string
  label: string
  status: RailStatus
  summary?: string
}

export interface MessageRunLike {
  id: string
  capability?: string
  title?: string
  steps: EnvelopeStep[]
  completed: boolean
}

const DRAFT_TOOLS = ['write_post', 'write_posts_batch', 'humanize', 'revise_draft', 'check_seo', 'check_geo', 'check_links']
const RESEARCH_TOOLS = ['research_topic', 'web_search', 'scrape_url', 'retrieve', 'scan_trends']
const BOARD_TOOLS = ['board_list', 'board_add_cards', 'board_move', 'board_update', 'subagent']
const CAROUSEL_TOOLS = ['generate_carousel', 'revise_carousel']
const IMAGE_TOOLS = [
  'render-design',
  'create-design',
  'batch-generate-designs',
  'get-design-template',
  'list-design-templates',
  'update-design',
  'create-asset-from-url',
]
const SCHEDULE_TOOLS = [
  'bulk_schedule_posts',
  'create_posts_batch',
  'schedule_direct_posts',
  'create-post',
  'publish-now',
  'retry-post',
]

const SECTION_ORDER: SectionKind[] = ['research', 'ideas', 'carousel', 'image', 'draft', 'schedule', 'board', 'delivery']

type Payload = Record<string, unknown> | null

function parsePayload(result: string | undefined): Payload {
  if (!result) return null
  try {
    const parsed: unknown = JSON.parse(result)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return null
  } catch {
    const start = result.indexOf('{')
    const end = result.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    return parseLooseObject(result.slice(start, end + 1))
  }
}

function parseLooseObject(json: string): Payload {
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

function isCarouselPayload(payload: Payload): boolean {
  return Array.isArray(payload?.slides)
}

function isIdeasPayload(payload: Payload): boolean {
  return Array.isArray(payload?.ideas) || Array.isArray(payload?.hooks)
}

function isDraftPayload(payload: Payload): boolean {
  return payload?.draft !== undefined || Array.isArray(payload?.drafts) || payload?.caption !== undefined || payload?.check !== undefined || Array.isArray(payload?.claims)
}

function isResearchPayload(payload: Payload): boolean {
  return payload?.brief !== undefined || Array.isArray(payload?.results) || Array.isArray(payload?.bestPosts)
}

function isBoardPayload(payload: Payload): boolean {
  return payload?.card !== undefined || Array.isArray(payload?.cards)
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function isDesignSummary(payload: Record<string, unknown>): boolean {
  return typeof payload.id === 'string' && typeof payload.title === 'string' && Array.isArray(payload.fields)
}

function isImagePayload(payload: Payload): boolean {
  if (!payload) return false
  const list = Array.isArray(payload.images) ? payload.images : Array.isArray(payload.results) ? payload.results : []
  const hasUrl = typeof payload.url === 'string'
    || typeof payload.assetUrl === 'string'
    || list.some(item => typeof (item as Record<string, unknown> | null)?.url === 'string')
  return hasUrl || isDesignSummary(payload)
}

function isScheduleItem(value: unknown): boolean {
  const record = recordOf(value)
  if (!record) return false
  return typeof record.postId === 'string' || typeof record.platform === 'string'
}

function isScheduleGroup(value: unknown): boolean {
  const record = recordOf(value)
  if (!record) return false
  return Array.isArray(record.items) || Array.isArray(record.rejected)
}

function isPostedResult(payload: Record<string, unknown>): boolean {
  return typeof payload.postId === 'string' && payload.scheduledAt !== undefined
}

function isItemList(value: unknown): boolean {
  return Array.isArray(value) && value.some(isScheduleItem)
}

function isSchedulePayload(payload: Payload): boolean {
  if (!payload) return false
  if (isPostedResult(payload)) return true
  if (Array.isArray(payload.results)) return payload.results.some(isScheduleGroup)
  return isItemList(payload.items)
}

const PAYLOAD_RULES: Array<[SectionKind, (payload: Payload) => boolean]> = [
  ['carousel', isCarouselPayload],
  ['image', isImagePayload],
  ['schedule', isSchedulePayload],
  ['ideas', isIdeasPayload],
  ['draft', isDraftPayload],
  ['research', isResearchPayload],
  ['board', isBoardPayload],
]

const NAME_RULES: Array<[SectionKind, string[]]> = [
  ['carousel', CAROUSEL_TOOLS],
  ['image', IMAGE_TOOLS],
  ['schedule', SCHEDULE_TOOLS],
  ['draft', DRAFT_TOOLS],
  ['research', RESEARCH_TOOLS],
  ['board', BOARD_TOOLS],
]

function payloadKindOf(payload: Payload): SectionKind | null {
  return PAYLOAD_RULES.find(([, matches]) => matches(payload))?.[0] ?? null
}

function nameKindOf(name: string): SectionKind | null {
  return NAME_RULES.find(([, names]) => names.includes(name))?.[0] ?? null
}

/** Lenient payload parse shared by section renderers (object or boxed array). */
export function parseSectionPayload(result: string | undefined): Record<string, unknown> | null {
  if (!result) return null
  try {
    const parsed: unknown = JSON.parse(result)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    if (Array.isArray(parsed)) return { items: parsed }
    return { value: parsed }
  } catch {
    return extractEmbeddedJson(result)
  }
}

function extractEmbeddedJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return { raw }
  } catch {
    return { raw }
  }
}

/** One section per tool call, payload shape first, tool name second. */
export function sectionKindOf(name: string, result?: string): SectionKind {
  const fromPayload = payloadKindOf(parsePayload(result))
  if (fromPayload) return fromPayload
  return nameKindOf(name) ?? 'delivery'
}

export interface EffectiveCall {
  name: string
  args: Record<string, unknown>
  result?: string
}

function featureNameOfCall(call: ToolCallLike, payload: Payload): string {
  if (typeof call.args?.feature === 'string') return call.args.feature
  return typeof payload?.feature === 'string' ? payload.feature : call.name
}

function nestedResultOf(payload: Payload): unknown {
  return payload && 'result' in payload ? payload.result : undefined
}

/**
 * `use_feature` hides the real tool behind its arguments. Every renderer reads
 * the effective call so a post, design or schedule produced through the
 * dispatcher looks the same as one produced by a curated tool.
 */
export function effectiveCall(call: ToolCallLike): EffectiveCall {
  if (call.name !== 'use_feature') {
    return { name: call.name, args: call.args ?? {}, result: call.result }
  }
  const payload = parsePayload(call.result)
  const args = recordOf(call.args?.arguments) ?? recordOf(payload?.arguments) ?? {}
  const nested = nestedResultOf(payload)
  return {
    name: featureNameOfCall(call, payload),
    args,
    result: nested === undefined ? call.result : JSON.stringify(nested),
  }
}

/** Section kind for a full call, including the `use_feature` indirection. */
export function sectionKindOfCall(call: ToolCallLike): SectionKind {
  const effective = effectiveCall(call)
  return sectionKindOf(effective.name, effective.result)
}

/** Group a run's calls into at most one section per kind, in rail order. */
export function groupSections(calls: ToolCallLike[]): RunSection[] {
  const groups = new Map<SectionKind, ToolCallLike[]>()
  for (const call of calls) {
    const kind = sectionKindOfCall(call)
    const list = groups.get(kind) ?? []
    list.push(call)
    groups.set(kind, list)
  }
  return SECTION_ORDER
    .filter(kind => groups.has(kind))
    .map(kind => ({ kind, calls: groups.get(kind) ?? [] }))
}

function shortLabel(name: string): string {
  const words = name.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function callToStep(call: ToolCallLike): RailStep {
  const label = shortLabel(effectiveCall(call).name)
  if (call.error) return { id: call.id, label, status: 'failed' }
  if (call.result) return { id: call.id, label, status: 'done' }
  return { id: call.id, label, status: 'running' }
}

function applyActiveMarker(steps: EnvelopeStep[]): RailStep[] {
  const firstOpen = steps.findIndex(step => step.status !== 'done' && step.status !== 'failed')
  return steps.map((step, index) => ({ id: step.id, label: step.label, status: index === firstOpen ? 'active' : step.status }))
}

/**
 * The step rail: envelope steps when the server sent them (with the first
 * open step highlighted), otherwise one step per tool call with its REAL
 * status — done, failed, or still running.
 */
export function railSteps(run: MessageRunLike | undefined, calls: ToolCallLike[]): RailStep[] {
  if (run && run.steps.length > 0) return applyActiveMarker(run.steps)
  return calls.map(callToStep)
}
