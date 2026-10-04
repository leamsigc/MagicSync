/**
 * T23 RunCard data helpers (PRD §4.6): group one run's tool calls into
 * presentational sections and derive the step rail from REAL statuses.
 *
 * Pure and framework-free (no Vue imports) so both the card components and
 * `node:test` cover the same logic. The rail prefers the server run/step
 * envelope when present and falls back to tool-call states otherwise — never
 * a faked local phase.
 */

export type SectionKind = 'research' | 'ideas' | 'carousel' | 'draft' | 'board' | 'delivery'
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

const DRAFT_TOOLS = ['write_post', 'humanize', 'revise_draft', 'check_seo', 'check_geo', 'check_links']
const RESEARCH_TOOLS = ['research_topic', 'web_search', 'scrape_url', 'retrieve', 'scan_trends']
const BOARD_TOOLS = ['board_list', 'board_add_cards', 'board_move', 'board_update', 'subagent']
const CAROUSEL_TOOLS = ['generate_carousel', 'revise_carousel']

const SECTION_ORDER: SectionKind[] = ['research', 'ideas', 'carousel', 'draft', 'board', 'delivery']

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
  return payload?.draft !== undefined || payload?.caption !== undefined || payload?.check !== undefined || Array.isArray(payload?.claims)
}

function isResearchPayload(payload: Payload): boolean {
  return payload?.brief !== undefined || Array.isArray(payload?.results) || Array.isArray(payload?.bestPosts)
}

function isBoardPayload(payload: Payload): boolean {
  return payload?.card !== undefined || Array.isArray(payload?.cards)
}

function payloadKindOf(payload: Payload): SectionKind | null {
  if (isCarouselPayload(payload)) return 'carousel'
  if (isIdeasPayload(payload)) return 'ideas'
  if (isDraftPayload(payload)) return 'draft'
  if (isResearchPayload(payload)) return 'research'
  if (isBoardPayload(payload)) return 'board'
  return null
}

function nameKindOf(name: string): SectionKind | null {
  if (CAROUSEL_TOOLS.includes(name)) return 'carousel'
  if (DRAFT_TOOLS.includes(name)) return 'draft'
  if (RESEARCH_TOOLS.includes(name)) return 'research'
  if (BOARD_TOOLS.includes(name)) return 'board'
  return null
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

/** Group a run's calls into at most one section per kind, in rail order. */
export function groupSections(calls: ToolCallLike[]): RunSection[] {
  const groups = new Map<SectionKind, ToolCallLike[]>()
  for (const call of calls) {
    const kind = sectionKindOf(call.name, call.result)
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
  if (call.error) return { id: call.id, label: shortLabel(call.name), status: 'failed' }
  if (call.result) return { id: call.id, label: shortLabel(call.name), status: 'done' }
  return { id: call.id, label: shortLabel(call.name), status: 'running' }
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
