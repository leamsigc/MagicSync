import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import { init, observe, type AgentInstanceHandle, type ConversationStreamChunk, type ToolDefinition } from '@flue/runtime'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { createEventEmitter, type AgentStreamEmitter, type AgentStreamEventListener } from '../agent/agent-events'
import {
  checkTokenBudget,
  enforceToolCallLimit,
  enforceTurnLimit,
  readAgentLimits,
  type AgentLimits,
  type LimitCheck,
} from '../utils/agent-limits'
import { resolveEmbedder } from '../utils/embeddings'
import { createAgentToolContext } from '../agent/tool-context'
import { createAgentToolBag, mountAgentTools } from '../agent/tools/mounts'
import { bindAgentConversation, releaseAgentConversation } from '../flue/agent-bindings'
import { createFlueComplete } from '../flue/complete'
import { MagicSyncAgent } from '../flue/magicsync-agent'
import { getFlueRuntime, registerBusinessProvider, type BusinessProviderRegistration } from '../flue/runtime'
import { agentRunService } from './agent-run.service'
import { agentSessionService } from './agent-session.service'
import { skillRegistryService } from '#layers/BaseDB/server/services/skill-registry.service'
import { AGENT_PROMPTS } from '../agent/prompts'
import { DEFAULT_SESSION_PROFILE, createSpecialistSubagents, findSpecialistProfile, type SpecialistSessionProfile } from '../flue/specialists'
import {
  findBundledSkill,
  formatBundledSkillsForPrompt,
  selectBundledSkills,
  type BundledSkill,
} from '../flue/skills'

/**
 * T29 — the agent runner is a thin adapter over Flue agent execution and the
 * conversation stream (PRD-FLUE-RUNTIME-CONVERGENCE §6.2, decisions D1/D2/D5).
 *
 * What this file owns now: `agent_runs` observability, the chat thread rows, the
 * run limits, the §3.2 SSE event contract the chat UI reads (mapped from Flue's
 * `ConversationStreamChunk`), tenant-scoped provider registration (T26) and the
 * guarded tool mount (T28).
 *
 * What it no longer owns: the run loop, the tool loop, streaming and the
 * transcript. Those are Flue's (`@flue/runtime`). pi is gone from this file.
 */
export interface AgentRunInput {
  userId: string
  businessId: string
  threadId: string
  text: string
  /** Predefined agent profile (default orchestrator). */
  agentName?: string
  /** User-selected tool subset; always intersected with the agent's own scope. */
  allowedTools?: string[]
  /** Extra bundled skill slugs loaded into the system prompt. */
  extraSkillSlugs?: string[]
  /** Extra registered skill ids (latest version) loaded into the system prompt. */
  extraRegisteredSkillIds?: string[]
  /** Pre-rendered extra prompt blocks (registered skill bodies). */
  extraPromptBlocks?: string[]
  sessionId?: string | null
  systemContext?: string | null
  instructions?: string | null
  provider?: string | null
  model?: string | null
  apiKey?: string | null
  apiBaseUrl?: string | null
  /** Test seam: explicit server-owned Flue tools (bypasses the tenant bag). */
  customTools?: ToolDefinition[]
  /** Headless task mode: no chat thread rows; fresh session per run. */
  headless?: boolean
  /** Request logger for run-level observability (start/finish with usage). */
  log?: RequestLogger
  /** Server-owned tenant context; tools are built inside the runner. */
  toolContext?: { userId: string, businessId: string, sessionId?: string, event?: H3Event, carouselRequest?: string }
  /** Optional per-request ceiling used by harness-routed single-tool workflows. */
  maxToolCalls?: number
  /** Prevent the model from invoking the same harness-owned workflow repeatedly. */
  singleToolCall?: boolean
}

export interface AgentRunSummary {
  runId: string
  sessionId: string
  threadId: string
  content: string
  tokensUsed: number
  toolCalls: number
  turns: number
  durationMs: number
  status: 'completed' | 'failed' | 'cancelled'
}

interface AgentError {
  code: string
  message: string
}

interface LimitFailure {
  code: string
  reason: string
}

interface RunTarget {
  registration: BusinessProviderRegistration
}

interface RunSetup {
  conversationId: string
  modelSpecifier: string
  instructions: string
  tools: ToolDefinition[]
  subagents: ReturnType<typeof createSpecialistSubagents>
  sessionId: string
}

interface RunState {
  runId: string
  userId: string
  sessionId: string
  threadId: string
  limits: AgentLimits
  emit: AgentStreamEmitter
  handle: AgentInstanceHandle | null
  submissionId: string
  /** Chunks are ours from the moment our own user message is appended. */
  projecting: boolean
  content: string
  reasoning: string
  turns: number
  toolCalls: number
  tokensUsed: number
  started: boolean
  toolEvents: unknown[]
  exceeded: LimitFailure | null
  error: AgentError | null
  errorEmitted: boolean
  /** Flue's settlement error text, mapped once when the read rejects. */
  settlementError: string | null
  historyEvents: unknown[]
  singleToolCall: boolean
  cancelRequested: boolean
}

interface ActiveRun {
  userId: string
  state: RunState
}

const activeRuns = new Map<string, ActiveRun>()

const WORK_SUMMARY = 'I completed the requested work. Review the generated result above.'

// ---------------------------------------------------------------------------
// Provider errors. Flue wraps the real provider message in a JSON envelope,
// sometimes twice (`{"message":"{\"error\":{\"message\":…}}"}`) and behind a
// harness prefix ("429: {...}"). Dig out the deepest human-readable message —
// the client surfaces it verbatim.
// ---------------------------------------------------------------------------

interface BraceScan {
  depth: number
  start: number
  inString: boolean
  escaped: boolean
}

function advanceString(scan: BraceScan, char: string): void {
  if (scan.escaped) {
    scan.escaped = false
    return
  }
  if (char === '\\') {
    scan.escaped = true
    return
  }
  if (char === '"') scan.inString = false
}

function closeBrace(scan: BraceScan, index: number, text: string, out: string[]): void {
  if (scan.depth === 0) return
  scan.depth -= 1
  if (scan.depth > 0 || scan.start < 0) return
  out.push(text.slice(scan.start, index + 1))
}

function scanChar(scan: BraceScan, char: string, index: number, text: string, out: string[]): void {
  if (scan.inString) {
    advanceString(scan, char)
    return
  }
  if (char === '"') {
    scan.inString = true
    return
  }
  if (char === '{') {
    if (scan.depth === 0) scan.start = index
    scan.depth += 1
    return
  }
  if (char === '}') closeBrace(scan, index, text, out)
}

/** Balanced `{...}` candidates, longest first — prose braces never match. */
function balancedCandidates(text: string): string[] {
  const scan: BraceScan = { depth: 0, start: -1, inString: false, escaped: false }
  const out: string[] = []
  for (let index = 0; index < text.length; index++) scanChar(scan, text[index]!, index, text, out)
  return out.sort((a, b) => b.length - a.length)
}

function parseObject(candidate: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(candidate)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null
  }
  catch {
    return null
  }
}

function nestedError(record: Record<string, unknown>): Record<string, unknown> | null {
  const error = record.error
  return typeof error === 'object' && error !== null ? error as Record<string, unknown> : null
}

function messageField(record: Record<string, unknown>): string | null {
  const inner = nestedError(record)?.message ?? record.message
  return typeof inner === 'string' && inner !== '' ? inner : null
}

function unwrapProviderMessage(raw: string, depth = 0): string {
  const text = raw.trim()
  if (depth >= 3) return text
  const candidate = text.startsWith('{') ? text : balancedCandidates(text)[0]
  const inner = candidate === undefined ? null : messageField(parseObject(candidate) ?? {})
  return inner === null ? text : unwrapProviderMessage(inner, depth + 1)
}

/** Coded classification; the real message is always preserved. */
const ERROR_RULES: Array<[RegExp, string]> = [
  [/abort/i, 'AGENT_ABORTED'],
  [/api key|unauthor|forbidden|invalid\s+key|401|403/i, 'PROVIDER_AUTH_FAILED'],
  [/quota|insufficient|billing|credit/i, 'PROVIDER_QUOTA_EXCEEDED'],
  [/rate limit|too many requests|429/i, 'PROVIDER_RATE_LIMITED'],
  [/timeout|timed out|etimedout|econnreset|econnrefused|fetch failed|network/i, 'PROVIDER_UNREACHABLE'],
  [/not found|does not exist|404/i, 'MODEL_NOT_AVAILABLE'],
]

function classifyAgentError(message: string): string {
  return ERROR_RULES.find(([pattern]) => pattern.test(message))?.[1] ?? 'AGENT_PROVIDER_ERROR'
}

function mapAgentError(error: unknown): AgentError {
  const raw = error instanceof Error ? error.message : String(error)
  const message = unwrapProviderMessage(raw)
  return { code: classifyAgentError(message), message }
}

// ---------------------------------------------------------------------------
// Tool-call history rows (the chat message metadata the tool panels read).
// ---------------------------------------------------------------------------

interface HistoryToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  error?: string
}

interface ToolEventShape {
  type?: string
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: unknown
  isError?: boolean
}

function resultText(value: unknown): string {
  if (typeof value === 'string') return value
  const content = (value as { content?: Array<{ type?: string, text?: string }> } | null)?.content
  if (Array.isArray(content)) {
    return content.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n')
  }
  try {
    return JSON.stringify(value ?? null)
  }
  catch {
    return String(value ?? '')
  }
}

function finishToolCall(call: HistoryToolCall, event: ToolEventShape): HistoryToolCall {
  const text = resultText(event.result)
  return event.isError ? { ...call, result: text, error: text } : { ...call, result: text }
}

function mergeToolEvent(events: Map<string, HistoryToolCall>, event: ToolEventShape): void {
  const id = event.toolCallId
  if (!id) return
  if (event.type === 'tool.started') {
    events.set(id, { id, name: event.toolName ?? 'unknown', args: event.args ?? {} })
    return
  }
  if (event.type !== 'tool.finished') return
  const existing = events.get(id) ?? { id, name: event.toolName ?? 'unknown', args: {} }
  events.set(id, finishToolCall(existing, event))
}

function buildToolCallsForHistory(toolEvents: unknown[]): HistoryToolCall[] {
  const events = new Map<string, HistoryToolCall>()
  for (const raw of toolEvents) mergeToolEvent(events, raw as ToolEventShape)
  return Array.from(events.values())
}

/** A tool the mount withheld (or a call the guard refused) is still auditable. */
function recordBlockedTool(state: RunState, toolName: string, reason?: string): void {
  state.toolEvents.push({ type: 'tool.blocked', toolName, reason })
}

// ---------------------------------------------------------------------------
// Run target: the business's own Flue provider (T26). Never boot options — the
// boot agent set stays constant so every tenant shares one runtime.
// ---------------------------------------------------------------------------

function resolveRunTarget(input: AgentRunInput): ServiceResponse<RunTarget> {
  const provider = input.provider ?? process.env.AGENT_DEFAULT_PROVIDER
  const modelId = input.model ?? process.env.AGENT_DEFAULT_MODEL
  if (!provider || !modelId) {
    return { success: false, error: 'No model configured for this business', code: 'MODEL_NOT_CONFIGURED' }
  }
  try {
    return { success: true, data: { registration: registerBusinessProvider({ businessId: input.businessId, provider, model: modelId, apiKey: input.apiKey, apiBaseUrl: input.apiBaseUrl }) } }
  }
  catch (error) {
    const code = (error as { code?: string }).code ?? 'MODEL_NOT_CONFIGURED'
    return { success: false, error: error instanceof Error ? error.message : 'Model is not configured', code }
  }
}

// ---------------------------------------------------------------------------
// Session identity. The `agent_chat_sessions` row stays the stable server-owned
// conversation handle (the chat's `sessionId`, the session picker, resume) and
// its `piSessionId` column now carries the Flue conversation id — the same id
// Flue addresses the run by. The transcript itself is Flue's; T30 moves it onto
// a durable adapter.
// ---------------------------------------------------------------------------

function conversationIdFor(sessionId: string): string {
  return `chat-${sessionId}`
}

async function loadStoredSession(userId: string, sessionId: string): Promise<ServiceResponse<{ sessionId: string }>> {
  const existing = await agentSessionService.getSession(userId, sessionId)
  if (!existing.success) return { success: false, error: existing.error, code: existing.code ?? 'NOT_FOUND' }
  return { success: true, data: { sessionId: existing.data.id } }
}

async function createFreshSession(userId: string, input: AgentRunInput): Promise<ServiceResponse<{ sessionId: string }>> {
  const created = await agentSessionService.createSession(userId, {
    businessId: input.businessId,
    piSessionId: conversationIdFor(crypto.randomUUID()),
    threadId: input.threadId,
  })
  if (!created.success) return { success: false, error: created.error, code: created.code }
  return { success: true, data: { sessionId: created.data.id } }
}

async function prepareSession(input: AgentRunInput): Promise<ServiceResponse<{ sessionId: string }>> {
  if (input.sessionId) return loadStoredSession(input.userId, input.sessionId)
  const existing = await agentSessionService.getByThread(input.userId, input.threadId)
  if (existing.success && existing.data) return loadStoredSession(input.userId, existing.data.id)
  return createFreshSession(input.userId, input)
}

// ---------------------------------------------------------------------------
// The profile a run mounts.
// ---------------------------------------------------------------------------

/**
 * A chat skill that owns its tool scope is also the profile for a headless run
 * invoked by slug — the topic-batch `trend-scout` scout is the live case. The
 * skill registry is then the single source of the tools it needs, exactly as
 * `SPECIALIST_SESSION_PROFILES` is for the Flue delegates.
 */
function skillProfile(name: string): SpecialistSessionProfile | undefined {
  const skill = findBundledSkill(name)
  if (!skill) return undefined
  return {
    ...DEFAULT_SESSION_PROFILE,
    name: skill.slug,
    description: skill.description,
    tools: skill.tools,
    skills: [skill.slug],
    forceSkills: [skill.slug],
  }
}

function resolveRunAgent(name?: string): SpecialistSessionProfile {
  if (!name) return DEFAULT_SESSION_PROFILE
  return findSpecialistProfile(name) ?? skillProfile(name) ?? DEFAULT_SESSION_PROFILE
}

/** The server-owned allowlist: the profile's own scope, narrowed by the caller. */
function resolveAllowedTools(profile: SpecialistSessionProfile, requested?: string[]): string[] {
  if (!requested) return [...profile.tools]
  const allowed = new Set(requested)
  return profile.tools.filter(tool => allowed.has(tool))
}

/**
 * A caller-supplied `customTools` list IS the mount — the same escape the pi
 * runner gave that test seam (it passed `customTools` straight to the session).
 * Only server-side callers can set it; no route or tool argument reaches it.
 */
function resolveMountAllowlist(profile: SpecialistSessionProfile, input: AgentRunInput): string[] {
  if (!input.customTools) return resolveAllowedTools(profile, input.allowedTools)
  return input.customTools.map(tool => tool.name)
}

function loadedSkillBlocks(slugs: string[]): string[] {
  return slugs
    .map(slug => findBundledSkill(slug))
    .filter((skill): skill is BundledSkill => skill !== undefined)
    .map(skill => `# Loaded skill: ${skill.name}\n\n${skill.body}`)
}

interface RegisteredSkillSnapshot {
  name?: unknown
  description?: unknown
  instructions?: unknown
}

/** Resolve registered skill ids to prompt blocks (latest version each). */
async function loadRegisteredSkillBlocks(userId: string, businessId: string, ids: string[]): Promise<string[]> {
  const listed = await skillRegistryService.listSkills(userId, businessId)
  const allowed = new Set((listed.success ? listed.data : []).map(skill => skill.id))
  const blocks: string[] = []
  for (const id of [...new Set(ids)].slice(0, 8)) {
    if (!allowed.has(id)) continue
    const resolved = await skillRegistryService.resolveSkillVersion(id)
    if (!resolved.success) continue
    const snapshot = resolved.data.snapshot as RegisteredSkillSnapshot
    const instructions = typeof snapshot.instructions === 'string' ? snapshot.instructions : ''
    const name = typeof snapshot.name === 'string' ? snapshot.name : id
    if (!instructions.trim()) continue
    blocks.push(`# Loaded skill: ${name}\n\n${instructions}`)
  }
  return blocks
}

function buildSystemPrompt(input: AgentRunInput, profile: SpecialistSessionProfile): string {
  const parts = [
    AGENT_PROMPTS.base,
    AGENT_PROMPTS[profile.prompt],
    formatBundledSkillsForPrompt(selectBundledSkills(profile.skills)),
    ...loadedSkillBlocks([...profile.forceSkills, ...(input.extraSkillSlugs ?? [])]),
    ...(input.extraPromptBlocks ?? []),
  ]
  if (input.systemContext) parts.push(input.systemContext)
  if (input.instructions) parts.push(input.instructions)
  return parts.filter(Boolean).join('\n\n')
}

// ---------------------------------------------------------------------------
// Flue conversation chunks → the §3.2 SSE contract (D5). The event names below
// and the `runId:seq` ids `createEventEmitter` stamps are unchanged from the pi
// runner, so the chat UI and the e2e specs keep working.
// ---------------------------------------------------------------------------

async function abortRun(state: RunState): Promise<void> {
  const handle = state.handle
  if (!handle) return
  await handle.abort()
}

function abortWithLimit(state: RunState, check: LimitCheck): void {
  if (check.allowed) return
  state.exceeded = check
  void abortRun(state)
}

/** Chunks are ours from our own user message onward; earlier ones are replay. */
function acceptChunk(state: RunState, chunk: ConversationStreamChunk): boolean {
  if (state.projecting) return true
  if (chunk.type !== 'message-appended') return false
  state.projecting = chunk.message.submissionId === state.submissionId
  return state.projecting
}

function openMessage(state: RunState): void {
  if (state.started) return
  state.started = true
  state.emit({ type: 'message.started', sessionId: state.sessionId })
}

function pushDelta(state: RunState, kind: 'text' | 'reasoning', delta: string): void {
  if (!delta) return
  if (kind === 'reasoning') {
    state.reasoning += delta
    state.emit({ type: 'thinking.delta', delta })
    return
  }
  state.emit({ type: 'text.delta', delta })
}

function openTool(state: RunState, toolCallId: string, toolName: string, args: unknown): void {
  if (state.singleToolCall && state.toolCalls > 0) {
    void abortRun(state)
    return
  }
  state.toolCalls += 1
  const started = { type: 'tool.started' as const, toolCallId, toolName, args }
  state.toolEvents.push(started)
  state.emit(started)
  abortWithLimit(state, enforceToolCallLimit(state.toolCalls, state.limits))
}

function closeTool(state: RunState, toolCallId: string, toolName: string, isError: boolean, result: unknown): void {
  const finished = { type: 'tool.finished' as const, toolCallId, toolName, isError, result }
  state.toolEvents.push(finished)
  void state.emit({
    type: 'step.completed',
    runId: state.runId,
    stepId: toolCallId,
    status: isError ? 'failed' : 'done',
    summary: toolName,
  })
  state.emit(finished)
}

function endTurn(state: RunState): void {
  state.turns += 1
  abortWithLimit(state, enforceTurnLimit(state.turns, state.limits))
  abortWithLimit(state, checkTokenBudget(state.tokensUsed, state.limits))
}

/** Flue's tool-output chunks carry no name; the started event recorded it. */
function toolNameOf(state: RunState, toolCallId: string): string {
  for (const raw of state.toolEvents) {
    const event = raw as ToolEventShape
    if (event.toolCallId === toolCallId) return event.toolName ?? 'unknown'
  }
  return 'unknown'
}

function closeToolFromChunk(state: RunState, chunk: ConversationStreamChunk): void {
  if (chunk.type === 'tool-output') {
    closeTool(state, chunk.toolCallId, toolNameOf(state, chunk.toolCallId), false, chunk.output)
    return
  }
  closeTool(state, chunk.toolCallId, toolNameOf(state, chunk.toolCallId), true, chunk.errorText)
}

function projectConversationChunk(state: RunState, chunk: ConversationStreamChunk): void {
  if (chunk.type === 'message-started') {
    openMessage(state)
    return
  }
  if (chunk.type === 'message-delta') {
    pushDelta(state, chunk.kind, chunk.delta)
    return
  }
  if (chunk.type === 'tool-input') {
    openTool(state, chunk.toolCallId, chunk.toolName, chunk.input)
    return
  }
  if (chunk.type === 'tool-output' || chunk.type === 'tool-output-error') {
    closeToolFromChunk(state, chunk)
    return
  }
  if (chunk.type === 'message-completed') endTurn(state)
}

function projectChunk(state: RunState, chunk: ConversationStreamChunk): void {
  if (!acceptChunk(state, chunk)) return
  if (chunk.type === 'submission-settled') {
    if (chunk.outcome !== 'completed') state.settlementError = chunk.error?.message ?? 'The agent run did not complete'
    return
  }
  if (chunk.type === 'message-completed') {
    endTurn(state)
    return
  }
  projectConversationChunk(state, chunk)
}

/**
 * One `observe()` subscriber per run, filtered to this submission: `turn` is the
 * only event carrying model usage, and `read()` settles without it.
 */
function watchUsage(state: RunState): () => void {
  return observe((event) => {
    if (event.type !== 'turn' || event.submissionId !== state.submissionId) return
    state.tokensUsed += event.response.usage?.totalTokens ?? 0
  })
}

// ---------------------------------------------------------------------------
// Completion of a run: observability, chat rows, terminal events.
// ---------------------------------------------------------------------------

function resolveFailure(state: RunState): AgentError | null {
  if (state.cancelRequested) return { code: 'AGENT_CANCELLED', message: 'Agent run cancelled' }
  if (state.error) return state.error
  if (state.exceeded) return { code: state.exceeded.code, message: state.exceeded.reason }
  return null
}

function buildSummary(runId: string, state: RunState, durationMs: number): AgentRunSummary {
  const failure = resolveFailure(state)
  return {
    runId,
    sessionId: state.sessionId,
    threadId: state.threadId,
    content: state.content.trim(),
    tokensUsed: state.tokensUsed,
    toolCalls: state.toolCalls,
    turns: state.turns,
    durationMs,
    status: state.cancelRequested ? 'cancelled' : failure ? 'failed' : 'completed',
  }
}

/** A run that only called tools still answers the chat with something. */
function withFallbackContent(summary: AgentRunSummary, state: RunState): AgentRunSummary {
  if (state.toolEvents.length === 0 || summary.content !== '') return summary
  return { ...summary, content: WORK_SUMMARY }
}

function logRunOutcome(input: AgentRunInput, state: RunState, summary: AgentRunSummary, failure: AgentError | null): void {
  const fields = {
    runId: summary.runId,
    tokensUsed: summary.tokensUsed,
    toolCalls: summary.toolCalls,
    turns: summary.turns,
    durationMs: summary.durationMs,
  }
  if (failure && !state.cancelRequested) {
    input.log?.error({ content: 'Agent run failed', ...fields, code: failure.code, message: failure.message })
    return
  }
  const content = state.cancelRequested ? 'Agent run cancelled' : 'Agent run completed'
  input.log?.info({ content, ...fields, output: summary.content })
}

function hasAssistantOutput(state: RunState, completed: AgentRunSummary, failure: AgentError | null): boolean {
  return completed.content !== ''
    || state.toolEvents.length > 0
    || state.reasoning !== ''
    || failure !== null
    || state.cancelRequested
}

async function persistAssistantMessage(
  input: AgentRunInput,
  state: RunState,
  completed: AgentRunSummary,
  failure: AgentError | null,
): Promise<void> {
  if (!hasAssistantOutput(state, completed, failure)) return
  await chatService.addMessage({
    threadId: input.threadId,
    userId: input.userId,
    role: 'assistant',
    content: failure && completed.content === '' ? failure.message : completed.content,
    metadata: {
      sessionId: state.sessionId,
      runId: state.runId,
      status: completed.status,
      reasoning: state.reasoning,
      toolCalls: buildToolCallsForHistory(state.toolEvents),
      toolCallsCount: state.toolCalls,
      toolEvents: state.toolEvents,
      events: state.historyEvents,
      cancelled: state.cancelRequested,
      error: failure?.message,
    },
  })
}

function emitTerminalEvents(state: RunState, completed: AgentRunSummary, failure: AgentError | null): void {
  if (failure && !state.cancelRequested && !state.errorEmitted) {
    state.errorEmitted = true
    state.emit({ type: 'error', code: failure.code, message: failure.message })
  }
  if (state.cancelRequested) {
    state.emit({ type: 'run.cancelled', runId: state.runId })
    return
  }
  if (failure) return
  state.emit({ type: 'message.completed', sessionId: state.sessionId, threadId: state.threadId, content: completed.content })
  state.emit({ type: 'run.completed', runId: state.runId, result: { content: completed.content } })
}

function emitRunLog(input: AgentRunInput, runId: string, summary: AgentRunSummary, failure: AgentError | null): void {
  emitLog(input.log, {
    message: failure ? 'ai.call.failed' : 'ai.call.completed',
    callName: 'agent.session',
    input: { system: (input.systemContext ?? '').slice(0, 12000), prompt: input.text.slice(0, 12000) },
    output: summary.content,
    error: failure?.message,
    runId,
    sessionId: summary.sessionId,
    durationMs: summary.durationMs,
    tokensUsed: summary.tokensUsed,
  })
}

// ---------------------------------------------------------------------------
// The runner.
// ---------------------------------------------------------------------------

export class AgentRunnerService {
  async cancel(userId: string, runId: string): Promise<ServiceResponse<{ runId: string }>> {
    const active = activeRuns.get(runId)
    if (!active || active.userId !== userId) {
      return { success: false, error: 'Agent run is not active', code: 'RUN_NOT_ACTIVE' }
    }
    active.state.cancelRequested = true
    await abortRun(active.state)
    return { success: true, data: { runId } }
  }

  async run(input: AgentRunInput, onEvent: AgentStreamEventListener): Promise<ServiceResponse<AgentRunSummary>> {
    const agentName = resolveRunAgent(input.agentName).name
    const runRow = await agentRunService.start(input.userId, { businessId: input.businessId, agentName })
    if (!runRow.success) return { success: false, error: runRow.error, code: runRow.code }
    const runId = runRow.data.id
    input.log?.info({ content: 'Agent run started', agentName, runId, businessId: input.businessId, threadId: input.threadId, headless: input.headless ?? false })
    const state = createState(input, runId, onEvent)
    void state.emit({ type: 'run.started', runId, title: 'Working on your request', steps: [] })
    return this.executeRun(input, runId, state)
  }

  /**
   * Headless task run for pipelines: same runtime, limits and agent_runs
   * telemetry as chat, but no chat thread/message rows and a fresh session.
   */
  async runTask(
    input: Omit<AgentRunInput, 'threadId' | 'headless'> & { threadId?: string },
    onEvent: AgentStreamEventListener = () => {},
  ): Promise<ServiceResponse<AgentRunSummary>> {
    return this.run({ ...input, threadId: input.threadId ?? `task:${crypto.randomUUID()}`, headless: true }, onEvent)
  }

  private async executeRun(
    input: AgentRunInput,
    runId: string,
    state: RunState,
  ): Promise<ServiceResponse<AgentRunSummary>> {
    const startedAt = Date.now()
    const setup = await this.setupRun(input, state)
    if (!setup.success) {
      state.emit({ type: 'error', code: setup.code ?? 'AGENT_SETUP_FAILED', message: setup.error })
      await agentRunService.finish(runId, { status: 'failed', durationMs: Date.now() - startedAt, summary: setup.error })
      return { success: false, error: setup.error, code: setup.code }
    }

    const stopWatching = watchUsage(state)
    try {
      await this.streamRun(input, setup.data, state)
    }
    catch (error) {
      state.error = mapAgentError(state.settlementError ?? error)
    }
    finally {
      stopWatching()
      activeRuns.delete(runId)
      state.handle = null
      releaseAgentConversation(setup.data.conversationId)
    }
    return this.settleRun(input, runId, state, Date.now() - startedAt)
  }

  /** Admit the submission, then project its conversation stream until settled. */
  private async streamRun(input: AgentRunInput, setup: RunSetup, state: RunState): Promise<void> {
    // Same boot options as the T25 HTTP mount: one runtime, one agent identity.
    await getFlueRuntime({ agents: [MagicSyncAgent] })
    bindAgentConversation(setup.conversationId, {
      model: setup.modelSpecifier,
      instructions: setup.instructions,
      tools: setup.tools,
      subagents: setup.subagents,
    })
    const handle = init(MagicSyncAgent, { id: setup.conversationId })
    state.handle = handle
    activeRuns.set(state.runId, { userId: input.userId, state })
    if (!input.headless) {
      await chatService.addMessage({ threadId: input.threadId, userId: input.userId, role: 'user', content: input.text })
    }
    emitLog(input.log, {
      message: 'ai.call.started',
      callName: 'agent.session',
      input: { system: (input.systemContext ?? '').slice(0, 12000), prompt: input.text.slice(0, 12000) },
      runId: state.runId,
      sessionId: state.sessionId,
    })
    const receipt = await handle.dispatch({ message: input.text })
    state.submissionId = receipt.submissionId
    state.content = (await handle.read(receipt, { onEvent: chunk => projectChunk(state, chunk) })).text
  }

  private async setupRun(input: AgentRunInput, state: RunState): Promise<ServiceResponse<RunSetup>> {
    const target = resolveRunTarget(input)
    if (!target.success) return { success: false, error: target.error, code: target.code }

    const persisted = await prepareSession(input)
    if (!persisted.success) return { success: false, error: persisted.error, code: persisted.code }
    state.sessionId = persisted.data.sessionId

    if (!input.extraPromptBlocks && (input.extraRegisteredSkillIds?.length ?? 0) > 0) {
      input.extraPromptBlocks = await loadRegisteredSkillBlocks(input.userId, input.businessId, input.extraRegisteredSkillIds ?? [])
    }

    const profile = resolveRunAgent(input.agentName)
    const embedder = await resolveEmbedder(input.userId, input.businessId)
    const toolContext = createAgentToolContext({
      ...input.toolContext,
      log: input.toolContext?.log ?? input.log,
      sessionId: state.sessionId,
      emit: state.emit,
      carouselRequest: input.toolContext?.carouselRequest,
      complete: createFlueComplete(target.data.registration, {
        log: input.log,
        callName: 'agent.tool.complete',
        metadata: { userId: input.userId, businessId: input.businessId, sessionId: state.sessionId },
      }),
      embed: embedder.success ? embedder.data : undefined,
    })
    const bag = input.customTools
      ? Object.fromEntries(input.customTools.map(tool => [tool.name, tool]))
      : createAgentToolBag(toolContext)
    const tools = mountAgentTools(Object.values(bag), {
      agent: profile.name,
      allowedTools: resolveMountAllowlist(profile, input),
      onAudit: entry => recordBlockedTool(state, entry.toolName, entry.reason),
    })
    return {
      success: true,
      data: {
        conversationId: conversationIdFor(state.sessionId),
        modelSpecifier: target.data.registration.modelSpecifier,
        instructions: buildSystemPrompt(input, profile),
        tools,
        subagents: createSpecialistSubagents({
          model: target.data.registration.modelSpecifier,
          systemContext: input.systemContext,
          userId: input.userId,
          businessId: input.businessId,
          complete: toolContext.complete,
          tools: bag,
        }),
        sessionId: state.sessionId,
      },
    }
  }

  private async settleRun(
    input: AgentRunInput,
    runId: string,
    state: RunState,
    durationMs: number,
  ): Promise<ServiceResponse<AgentRunSummary>> {
    const completed = withFallbackContent(buildSummary(runId, state, durationMs), state)
    const failure = resolveFailure(state)
      ?? (completed.content === '' ? { code: 'AGENT_EMPTY_RESPONSE', message: 'The model completed without returning a response' } : null)
    emitRunLog(input, runId, completed, failure)
    await agentRunService.finish(runId, {
      status: state.cancelRequested ? 'cancelled' : failure ? 'failed' : 'completed',
      tokensUsed: completed.tokensUsed,
      durationMs: completed.durationMs,
      toolEvents: state.toolEvents,
      summary: failure ? failure.message : completed.content.slice(0, 500),
    })
    logRunOutcome(input, state, completed, failure)
    if (!input.headless) await persistAssistantMessage(input, state, completed, failure)
    emitTerminalEvents(state, completed, failure)
    return failure
      ? { success: false, error: failure.message, code: failure.code }
      : { success: true, data: completed }
  }
}

function createState(input: AgentRunInput, runId: string, onEvent: AgentStreamEventListener): RunState {
  const limits = readAgentLimits()
  if (input.maxToolCalls !== undefined) limits.maxToolCalls = Math.min(limits.maxToolCalls, input.maxToolCalls)
  const historyEvents: unknown[] = []
  const emit = createEventEmitter(runId, (event) => {
    historyEvents.push(event)
    return onEvent(event)
  })
  return {
    runId,
    userId: input.userId,
    sessionId: '',
    threadId: input.threadId,
    limits,
    emit,
    handle: null,
    submissionId: '',
    projecting: false,
    content: '',
    reasoning: '',
    turns: 0,
    toolCalls: 0,
    tokensUsed: 0,
    started: false,
    toolEvents: [],
    exceeded: null,
    error: null,
    errorEmitted: false,
    settlementError: null,
    historyEvents,
    singleToolCall: input.singleToolCall ?? false,
    cancelRequested: false,
  }
}

export const agentRunnerService = new AgentRunnerService()