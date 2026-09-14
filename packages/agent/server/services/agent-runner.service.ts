import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { H3Event } from 'h3'
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ModelRuntime,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent'
import type { Model } from '@earendil-works/pi-ai'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { createEventEmitter, type AgentStreamEventListener } from '../agent/agent-events'
import {
  checkTokenBudget,
  enforceToolCallLimit,
  enforceTurnLimit,
  readAgentLimits,
  type AgentLimits,
  type LimitCheck,
} from '../utils/agent-limits'
import { resolveEmbedder } from '../utils/embeddings'
import { applyRunApiKey, applyRunBaseUrl, createAgentComplete, createAgentModelRuntime, resolveRunModel } from '../utils/pi-runtime'
import { anonymize, isPiiReady, SurrogateRestorer } from '../utils/pii'
import { createAgentToolContext } from '../agent/tool-context'
import { createAgentTools } from '../agent/tools'
import { agentRunService } from './agent-run.service'
import { agentSessionService } from './agent-session.service'
import { piiMappingService } from './pii-mapping.service'
import { AGENT_PROMPTS } from '../agent/prompts'
import { findPredefinedAgent, PREDEFINED_AGENTS, type PredefinedAgent } from '../agent/agents'
import { createGuardExtension } from '../agent/extensions'
import {
  findBundledSkill,
  formatBundledSkillsForPrompt,
  selectBundledSkills,
  type BundledSkill,
} from '../agent/skills'

const BUILTIN_TOOL_EXCLUSIONS = ['bash', 'read', 'write', 'edit', 'find', 'grep', 'ls', 'powershell']

export interface AgentRunInput {
  userId: string
  businessId: string
  threadId: string
  text: string
  /** Predefined agent profile (default orchestrator). */
  agentName?: string
  sessionId?: string | null
  systemContext?: string | null
  instructions?: string | null
  provider?: string | null
  model?: string | null
  apiKey?: string | null
  apiBaseUrl?: string | null
  privateMode?: boolean
  /** Test seam: inject a prepared runtime (stub provider). */
  modelRuntime?: ModelRuntime
  /** Test seam: explicit server-owned tools (bypasses toolContext). */
  customTools?: ToolDefinition[]
  /** Headless task mode: no chat thread rows; fresh session per run. */
  headless?: boolean
  /** Server-owned tenant context; tools are built inside the runner against the resolved model. */
  toolContext?: { userId: string, businessId: string, sessionId?: string, event?: H3Event }
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
  status: 'completed' | 'failed'
}

interface ResolvedTarget {
  runtime: ModelRuntime
  model: Model<any>
  provider: string
}

interface PersistedSession {
  sessionId: string
  piSessionId: string
  entries: unknown[]
}

interface RunState {
  userId: string
  sessionId: string
  threadId: string
  limits: AgentLimits
  emit: ReturnType<typeof createEventEmitter>
  session: AgentSession | null
  content: string
  turns: number
  toolCalls: number
  tokensUsed: number
  started: boolean
  toolEvents: unknown[]
  exceeded: Extract<LimitCheck, { allowed: false }> | null
  error: { code: string, message: string } | null
  persistChain: Promise<void>
  persistFailed: boolean
  persistedCount: number
  restorer: SurrogateRestorer | null
}

function mapAgentError(error: unknown): { code: string, message: string } {
  const message = error instanceof Error ? error.message : String(error)
  if (/abort/i.test(message)) return { code: 'AGENT_ABORTED', message: 'Agent run was aborted' }
  if (/api key|unauthor|forbidden|401|403/i.test(message)) return { code: 'PROVIDER_AUTH_FAILED', message }
  if (/timeout|timed out/i.test(message)) return { code: 'AGENT_TIMEOUT', message }
  return { code: 'AGENT_ERROR', message }
}

async function resolveRunTarget(input: AgentRunInput): Promise<ServiceResponse<ResolvedTarget>> {
  const provider = input.provider ?? process.env.AGENT_DEFAULT_PROVIDER
  const modelId = input.model ?? process.env.AGENT_DEFAULT_MODEL
  if (!provider || !modelId) {
    return { success: false, error: 'No model configured for this business', code: 'MODEL_NOT_CONFIGURED' }
  }
  const runtime = input.modelRuntime ?? await createAgentModelRuntime()
  if (input.apiBaseUrl) applyRunBaseUrl(runtime, provider, input.apiBaseUrl)
  if (input.apiKey) await applyRunApiKey(runtime, provider, input.apiKey)
  const model = resolveRunModel(runtime, provider, modelId)
  if (!model) {
    return { success: false, error: `Model ${provider}/${modelId} is not available`, code: 'MODEL_NOT_AVAILABLE' }
  }
  return { success: true, data: { runtime, model, provider } }
}

async function loadStoredSession(userId: string, sessionId: string): Promise<ServiceResponse<PersistedSession>> {
  const existing = await agentSessionService.getSession(userId, sessionId)
  if (!existing.success) {
    return { success: false, error: existing.error, code: existing.code ?? 'NOT_FOUND' }
  }
  const stored = await agentSessionService.loadEntries(userId, sessionId)
  if (!stored.success) return { success: false, error: stored.error, code: stored.code }
  return {
    success: true,
    data: {
      sessionId: existing.data.id,
      piSessionId: existing.data.piSessionId,
      entries: (stored.data ?? []).map(row => row.entry),
    },
  }
}

async function createFreshSession(userId: string, input: AgentRunInput): Promise<ServiceResponse<PersistedSession>> {
  const created = await agentSessionService.createSession(userId, {
    businessId: input.businessId,
    piSessionId: crypto.randomUUID(),
    threadId: input.threadId,
    privateMode: input.privateMode ?? false,
  })
  if (!created.success) return { success: false, error: created.error, code: created.code }
  return { success: true, data: { sessionId: created.data.id, piSessionId: created.data.piSessionId, entries: [] } }
}

function resolveRunAgent(name?: string): PredefinedAgent {
  const requested = name ? findPredefinedAgent(name) : undefined
  return requested ?? findPredefinedAgent('orchestrator') ?? PREDEFINED_AGENTS[0]!
}

function loadedSkillBlocks(slugs: string[]): string[] {
  return slugs
    .map(slug => findBundledSkill(slug))
    .filter((skill): skill is BundledSkill => skill !== undefined)
    .map(skill => `# Loaded skill: ${skill.name}\n\n${skill.body}`)
}

function buildSystemPrompt(input: AgentRunInput): string {
  const agent = resolveRunAgent(input.agentName)
  const parts = [
    AGENT_PROMPTS.base,
    AGENT_PROMPTS[agent.prompt],
    formatBundledSkillsForPrompt(selectBundledSkills(agent.skills)),
    ...loadedSkillBlocks(agent.forceSkills),
  ]
  if (input.systemContext) parts.push(input.systemContext)
  if (input.instructions) parts.push(input.instructions)
  return parts.filter(Boolean).join('\n\n')
}

function abortWithLimit(state: RunState, check: LimitCheck) {
  if (check.allowed) return
  state.exceeded = check
  void state.session?.abort()
}

/** Persist every session entry added since the last flush (pi has no message hook). */
function persistNewEntries(state: RunState) {
  const entries = state.session?.sessionManager.getEntries() ?? []
  const fresh = entries.slice(state.persistedCount)
  if (fresh.length === 0) return
  state.persistedCount = entries.length
  state.persistChain = state.persistChain
    .then(() => agentSessionService.appendEntries(state.userId, state.sessionId, fresh))
    .then(result => {
      if (!result.success) state.persistFailed = true
    })
}

const PI_EVENT_HANDLERS: Record<string, (state: RunState, event: any) => void> = {
  message_start: (state, event) => {
    if (state.started || event.message?.role !== 'assistant') return
    state.started = true
    state.emit({ type: 'message.started', sessionId: state.sessionId })
  },
  message_update: (state, event) => {
    const update = event.assistantMessageEvent
    if (update?.type === 'thinking_delta' && update.delta) {
      state.emit({ type: 'thinking.delta', delta: update.delta })
    }
    if (update?.type === 'text_delta' && update.delta) {
      const restored = state.restorer ? state.restorer.push(update.delta) : update.delta
      if (restored) {
        state.content += restored
        state.emit({ type: 'text.delta', delta: restored })
      }
    }
  },
  message_end: (state, event) => {
    const usage = event.message?.usage
    if (event.message?.role === 'assistant' && usage?.totalTokens) state.tokensUsed = usage.totalTokens
    abortWithLimit(state, checkTokenBudget(state.tokensUsed, state.limits))
  },
  tool_execution_start: (state, event) => {
    state.toolCalls += 1
    state.toolEvents.push({ type: 'tool.started', toolCallId: event.toolCallId, toolName: event.toolName, args: event.args })
    state.emit({ type: 'tool.started', toolCallId: event.toolCallId, toolName: event.toolName, args: event.args })
    abortWithLimit(state, enforceToolCallLimit(state.toolCalls, state.limits))
  },
  tool_execution_update: (state, event) => {
    state.emit({ type: 'tool.progress', toolCallId: event.toolCallId, toolName: event.toolName, partial: event.partialResult })
  },
  tool_execution_end: (state, event) => {
    state.toolEvents.push({ type: 'tool.finished', toolCallId: event.toolCallId, toolName: event.toolName, isError: event.isError })
    state.emit({
      type: 'tool.finished',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      isError: event.isError,
      result: event.result,
    })
  },
  turn_end: (state) => {
    state.turns += 1
    persistNewEntries(state)
    abortWithLimit(state, enforceTurnLimit(state.turns, state.limits))
  },
}

interface RunSetup {
  session: AgentSession
  sessionId: string
  cleanup: () => Promise<void>
}

export class AgentRunnerService {
  async run(input: AgentRunInput, onEvent: AgentStreamEventListener): Promise<ServiceResponse<AgentRunSummary>> {
    const runRow = await agentRunService.start(input.userId, { businessId: input.businessId, agentName: resolveRunAgent(input.agentName).name })
    if (!runRow.success) return { success: false, error: runRow.error, code: runRow.code }
    const runId = runRow.data.id
    const state: RunState = {
      userId: input.userId,
      sessionId: '',
      threadId: input.threadId,
      limits: readAgentLimits(),
      emit: createEventEmitter(runId, onEvent),
      session: null,
      content: '',
      turns: 0,
      toolCalls: 0,
      tokensUsed: 0,
      started: false,
      toolEvents: [],
      exceeded: null,
      error: null,
      persistChain: Promise.resolve(),
      persistFailed: false,
      persistedCount: 0,
      restorer: null,
    }
    return this.executeRun(input, runId, state)
  }

  /**
   * Headless task run for pipelines: same runtime, limits, and agent_runs
   * telemetry as chat, but no chat thread/message rows and a fresh session.
   */
  async runTask(
    input: Omit<AgentRunInput, 'threadId' | 'headless'> & { threadId?: string },
    onEvent: AgentStreamEventListener = () => {},
  ): Promise<ServiceResponse<AgentRunSummary>> {
    return this.run({ ...input, threadId: input.threadId ?? `task:${crypto.randomUUID()}`, headless: true }, onEvent)
  }

  private async preparePrompt(input: AgentRunInput, state: RunState): Promise<string> {
    if (!input.privateMode) return input.text
    const anonymized = await anonymize(input.text)
    state.restorer = new SurrogateRestorer(anonymized.mappings)
    await piiMappingService.replaceMappings(input.businessId, input.threadId, anonymized.mappings)
    return anonymized.text
  }

  private async executeRun(
    input: AgentRunInput,
    runId: string,
    state: RunState,
  ): Promise<ServiceResponse<AgentRunSummary>> {
    const startedAt = Date.now()
    if (input.privateMode && !isPiiReady()) {
      const message = 'Private mode requires the PII model; run scripts/pii_assets.sh'
      state.emit({ type: 'error', code: 'PII_MODEL_MISSING', message })
      await agentRunService.finish(runId, { status: 'failed', durationMs: Date.now() - startedAt, summary: message })
      return { success: false, error: message, code: 'PII_MODEL_MISSING' }
    }

    const setup = await this.setupRun(input, state)
    if (!setup.success) {
      state.emit({ type: 'error', code: setup.code ?? 'AGENT_SETUP_FAILED', message: setup.error })
      await agentRunService.finish(runId, { status: 'failed', durationMs: Date.now() - startedAt, summary: setup.error })
      return { success: false, error: setup.error, code: setup.code }
    }

    const { session, sessionId, cleanup } = setup.data
    try {
      state.session = session
      if (!input.headless) {
        await chatService.addMessage({ threadId: input.threadId, userId: input.userId, role: 'user', content: input.text })
      }
      await session.prompt(await this.preparePrompt(input, state))
    } catch (error) {
      state.error = mapAgentError(error)
    } finally {
      persistNewEntries(state)
      if (state.restorer) {
        const tail = state.restorer.flush()
        if (tail) state.content += tail
      }
      state.session = null
    }
    await state.persistChain

    const summary = this.buildSummary(runId, session, state, Date.now() - startedAt)
    const failure = this.resolveFailure(state)
    await agentRunService.finish(runId, {
      status: failure ? 'failed' : 'completed',
      tokensUsed: summary.tokensUsed,
      durationMs: summary.durationMs,
      toolEvents: state.toolEvents,
      summary: failure ? failure.message : summary.content.slice(0, 500),
    })

    if (!failure && summary.content && !input.headless) {
      await chatService.addMessage({
        threadId: input.threadId,
        userId: input.userId,
        role: 'assistant',
        content: summary.content,
        metadata: { sessionId, runId, toolCalls: state.toolCalls },
      })
    }
    if (failure) state.emit({ type: 'error', code: failure.code, message: failure.message })
    if (!failure) state.emit({ type: 'message.completed', sessionId, threadId: input.threadId, content: summary.content })

    session.dispose()
    await cleanup()
    return failure ? { success: false, error: failure.message, code: failure.code } : { success: true, data: summary }
  }

  private async setupRun(input: AgentRunInput, state: RunState): Promise<ServiceResponse<RunSetup>> {
    const target = await resolveRunTarget(input)
    if (!target.success) return { success: false, error: target.error, code: target.code }

    const persisted = await this.prepareSession(input)
    if (!persisted.success) return { success: false, error: persisted.error, code: persisted.code }
    state.sessionId = persisted.data.sessionId
    state.persistedCount = persisted.data.entries.length

    const dirs = await mkdtemp(join(tmpdir(), `magicsync-agent-${persisted.data.sessionId.slice(0, 8)}-`))
    try {
      const cwd = join(dirs, 'workspace')
      const agentDir = join(dirs, 'agent')
      await mkdir(cwd, { recursive: true })
      await mkdir(agentDir, { recursive: true })

      const embedder = await resolveEmbedder(input.userId, input.businessId)
      const agent = resolveRunAgent(input.agentName)
      const toolContext = createAgentToolContext({
        ...input.toolContext,
        sessionId: state.sessionId,
        emit: state.emit,
        complete: createAgentComplete(target.data.runtime, target.data.model),
        embed: embedder.success ? embedder.data : undefined,
        modelRuntime: target.data.runtime,
        model: target.data.model,
      })
      const customTools = input.customTools
        ?? (input.toolContext
          ? createAgentTools(toolContext).filter(tool => agent.tools.includes(tool.name))
          : [])
      toolContext.subagentTools = customTools

      const resourceLoader = new DefaultResourceLoader({
        cwd,
        agentDir,
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        systemPrompt: buildSystemPrompt(input),
        extensionFactories: [
          createGuardExtension({
            allowedTools: customTools.map(tool => tool.name),
            privateMode: input.privateMode ?? false,
            onAudit: (entry) => {
              if (entry.blocked) state.toolEvents.push({ type: 'tool.blocked', toolName: entry.toolName, reason: entry.reason })
            },
          }),
        ],
      })
      await resourceLoader.reload()

      const { session } = await createAgentSession({
        cwd,
        agentDir,
        model: target.data.model,
        modelRuntime: target.data.runtime,
        noTools: 'all',
        tools: customTools.map(tool => tool.name),
        excludeTools: BUILTIN_TOOL_EXCLUSIONS,
        customTools,
        sessionManager: SessionManager.inMemory(cwd, { id: persisted.data.piSessionId }, persisted.data.entries),
        settingsManager: SettingsManager.inMemory({
          compaction: { enabled: true },
          retry: { enabled: true },
        }),
        resourceLoader,
      })
      session.subscribe((event) => {
        PI_EVENT_HANDLERS[event.type]?.(state, event)
      })
      return {
        success: true,
        data: { session, sessionId: persisted.data.sessionId, cleanup: () => rm(dirs, { recursive: true, force: true }) },
      }
    } catch (error) {
      await rm(dirs, { recursive: true, force: true })
      return { success: false, error: mapAgentError(error).message, code: 'AGENT_SETUP_FAILED' }
    }
  }

  private async prepareSession(input: AgentRunInput): Promise<ServiceResponse<PersistedSession>> {
    if (input.sessionId) return loadStoredSession(input.userId, input.sessionId)
    const existing = await agentSessionService.getByThread(input.userId, input.threadId)
    if (existing.success && existing.data) return loadStoredSession(input.userId, existing.data.id)
    return createFreshSession(input.userId, input)
  }

  private resolveFailure(state: RunState): { code: string, message: string } | null {
    if (state.error) return state.error
    if (state.exceeded) return { code: state.exceeded.code, message: state.exceeded.reason }
    if (state.persistFailed) return { code: 'AGENT_PERSIST_FAILED', message: 'Failed to persist agent session entries' }
    return null
  }

  private buildSummary(runId: string, session: AgentSession, state: RunState, durationMs: number): AgentRunSummary {
    const stats = session.getSessionStats()
    const failure = this.resolveFailure(state)
    return {
      runId,
      sessionId: state.sessionId,
      threadId: state.threadId,
      content: state.content.trim(),
      tokensUsed: Math.max(state.tokensUsed, stats.tokens.total),
      toolCalls: state.toolCalls,
      turns: state.turns,
      durationMs,
      status: failure ? 'failed' : 'completed',
    }
  }
}

export const agentRunnerService = new AgentRunnerService()
