import { ref, computed, watch, onMounted } from 'vue'
import { useChatHistoryState, type ComponentState } from './useChatHistoryState'

/**
 * T23 one-card-per-run state (§4.6 envelope). Steps carry REAL statuses from
 * `step.completed` events; while the pi runner is the producer the card falls
 * back to tool-call-derived steps (see `runSections.ts`) — never a faked
 * local phase.
 */
export interface MessageRunStep {
  id: string
  label: string
  status: 'done' | 'active' | 'todo' | 'failed' | 'running'
  summary?: string
}

export interface MessageRunState {
  id: string
  capability?: string
  title?: string
  steps: MessageRunStep[]
  approval?: { stepId: string, actions: Array<{ id: string, label: string }> } | null
  completed: boolean
  cancelled?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: { kind?: string }
  parts?: Array<{ type: 'text' | 'tool'; text?: string; tool?: string }>
  reasoningContent?: string
  /** Complete normalized server event history for replay/debug rendering. */
  machineEvents?: Array<Record<string, unknown>>
  toolCalls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
    result?: string
    error?: string
  }>
  run?: MessageRunState
}

/** Live background-activity entry for the chat log panel. */
export interface ActivityEntry {
  id: string
  at: string
  type: 'tool.started' | 'tool.progress' | 'tool.finished' | 'error' | 'run'
  toolName?: string
  status?: 'running' | 'done' | 'failed'
  detail?: string
}

interface Thread {
  id: string
  title: string
  lastMessageAt: string | null
}

interface StreamChunk {
  type: string
  id?: string
  delta?: string
  sessionId?: string
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
  isError?: boolean
  result?: unknown
  code?: string
  message?: string
  runId?: string
  capability?: string
  title?: string
  steps?: Array<{ id: string, label: string }>
  stepId?: string
  status?: 'done' | 'failed'
  summary?: string
  data?: unknown
  actions?: Array<{ id: string, label: string }>
}

const THREAD_ID_STORAGE_KEY = 'ai-chat-thread-id'

export interface BusinessContextOptions {
  businessId?: string
  cardId?: string
  /** Existing pi session to resume (server creates one when omitted). */
  sessionId?: string | null
  /** Predefined agent profile (orchestrator when omitted or unknown). */
  agentName?: string
  /** Tool subset; always intersected server-side with the agent's scope. */
  allowedTools?: string[]
  /** Bundled skill slugs loaded into the system prompt. */
  skillSlugs?: string[]
  /** Registered skill ids (latest version) loaded into the system prompt. */
  registeredSkillIds?: string[]
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function toolResultText(result: unknown): string {
  if (typeof result === 'string') return result
  const content = (result as { content?: Array<{ type?: string, text?: string }> } | null)?.content
  if (Array.isArray(content)) {
    return content.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n')
  }
  return JSON.stringify(result ?? null)
}

function appendText(message: ChatMessage, text: string) {
  message.content += text
  message.parts = message.parts ?? []
  const lastPart = message.parts[message.parts.length - 1]
  if (lastPart?.type === 'text') {
    lastPart.text = (lastPart.text || '') + text
    return
  }
  message.parts.push({ type: 'text', text })
}

function findToolCall(message: ChatMessage, chunk: StreamChunk) {
  const calls = message.toolCalls ?? []
  const id = chunk.toolCallId || chunk.id
  return calls.find(call => call.id === id) ?? calls.find(call => call.name === chunk.toolName)
}

interface ChunkContext {
  message: ChatMessage
  onError: (chunk: StreamChunk) => void
  onArtifact: () => void
  onReasoning: (text: string) => void
  onSession: (id: string) => void
  onRun: (id: string) => void
  onActivity: (entry: ActivityEntry) => void
}

function argsSummary(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  return Object.entries(args).slice(0, 2).map(([key, value]) => `${key}: ${String(value).slice(0, 40)}`).join(' · ')
}

const CHUNK_HANDLERS: Record<string, (chunk: StreamChunk, ctx: ChunkContext) => void> = {
  'message.started': (chunk, ctx) => {
    if (chunk.sessionId) ctx.onSession(chunk.sessionId)
  },
  'thinking.delta': (chunk, ctx) => {
    if (chunk.delta) ctx.onReasoning(chunk.delta)
  },
  'text.delta': (chunk, ctx) => {
    if (chunk.delta) appendText(ctx.message, chunk.delta)
  },
  'tool.started': (chunk, ctx) => {
    ctx.message.toolCalls = ctx.message.toolCalls ?? []
    ctx.message.toolCalls.push({ id: chunk.toolCallId || chunk.id || generateId(), name: chunk.toolName || 'unknown', args: chunk.args || {} })
    ctx.message.parts = ctx.message.parts ?? []
    ctx.message.parts.push({ type: 'tool', tool: chunk.toolName || 'unknown' })
    ctx.onActivity({ id: chunk.toolCallId || generateId(), at: new Date().toISOString(), type: 'tool.started', toolName: chunk.toolName || 'unknown', status: 'running', detail: argsSummary(chunk.args) })
  },
  'tool.finished': (chunk, ctx) => {
    const toolCall = findToolCall(ctx.message, chunk)
    if (!toolCall) return
    toolCall.result = toolResultText(chunk.result)
    if (chunk.isError) toolCall.error = toolCall.result
    ctx.onActivity({ id: chunk.toolCallId || generateId(), at: new Date().toISOString(), type: 'tool.finished', toolName: chunk.toolName || toolCall.name, status: chunk.isError ? 'failed' : 'done', detail: toolCall.result.slice(0, 120) })
  },
  'error': (chunk, ctx) => {
    ctx.onError(chunk)
    ctx.onActivity({ id: generateId(), at: new Date().toISOString(), type: 'error', status: 'failed', detail: (chunk.message || chunk.code || 'Agent error').slice(0, 120) })
  },
  'artifact.created': (_chunk, ctx) => {
    ctx.onArtifact()
  },
  'review.required': (_chunk, ctx) => {
    ctx.onArtifact()
  },
  'run.started': (chunk, ctx) => {
    if (chunk.runId) ctx.onRun(chunk.runId)
    ctx.message.run = {
      id: chunk.runId || chunk.id || generateId(),
      capability: chunk.capability,
      title: chunk.title,
      steps: (chunk.steps ?? []).map(step => ({ id: step.id, label: step.label, status: 'todo' as const })),
      approval: null,
      completed: false,
    }
  },
  'step.completed': (chunk, ctx) => {
    const run = ctx.message.run
    if (!run || !chunk.stepId) return
    const step = run.steps.find(candidate => candidate.id === chunk.stepId)
    if (step) {
      step.status = chunk.status ?? 'done'
      if (chunk.summary) step.summary = chunk.summary
      return
    }
    run.steps.push({
      id: chunk.stepId,
      label: chunk.summary || chunk.stepId,
      status: chunk.status ?? 'done',
      summary: chunk.summary,
    })
  },
  'approval.required': (chunk, ctx) => {
    const run = ctx.message.run
    if (!run) return
    run.approval = { stepId: chunk.stepId || '', actions: chunk.actions ?? [] }
  },
  'run.completed': (chunk, ctx) => {
    const run = ctx.message.run
    if (!run) return
    run.completed = true
  },
  'run.cancelled': (chunk, ctx) => {
    const run = ctx.message.run
    if (!run) return
    run.cancelled = true
    run.completed = true
  },
}

function parseChunk(json: string): StreamChunk | null {
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return null
    if (typeof (parsed as { type?: unknown }).type !== 'string') return null
    return parsed as StreamChunk
  }
  catch {
    return null
  }
}

async function consumeEventStream(
  body: ReadableStream<Uint8Array>,
  context: ChunkContext,
  onCompleted: (chunk: StreamChunk) => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      newlineIndex = buffer.indexOf('\n')
      if (!line.startsWith('data: ')) continue
      const chunk = parseChunk(line.slice(6).trim())
      if (!chunk) continue
      if (chunk.type === 'message.completed') onCompleted(chunk)
      CHUNK_HANDLERS[chunk.type]?.(chunk, context)
    }
  }
}

export function useAgentChat() {
  const { t } = useI18n()
  const toast = useToast()
  const threads = ref<Thread[]>([])
  const isLoadingThreads = ref(false)
  const threadId = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const isStreaming = ref(false)
  const isCancelling = ref(false)
  const activeRunId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const artifactSignal = ref(0)
  const activityLog = ref<ActivityEntry[]>([])
  const { saveMessageState, getMessageState } = useChatHistoryState()

  let abortController: AbortController | null = null
  let loadSeq = 0

  let loadThreads: () => Promise<void>
  let loadThreadMessages: (id: string) => Promise<void>

  function handleStreamError(chunk: StreamChunk) {
    const raw = chunk.message || chunk.code || 'Agent error'
    toast.add({
      title: t('error'),
      description: raw.split('\n')[0] ?? raw,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }

  function notifyArtifacts() {
    artifactSignal.value += 1
  }

  function recordActivity(entry: ActivityEntry) {
    let index = activityLog.value.findIndex(existing => existing.id === entry.id)
    if (index === -1 && entry.status !== 'running') {
      index = [...activityLog.value].reverse().findIndex(existing => existing.toolName === entry.toolName && existing.status === 'running')
      if (index !== -1) index = activityLog.value.length - 1 - index
    }
    if (index === -1) {
      activityLog.value = [...activityLog.value.slice(-99), entry]
      return
    }
    const next = [...activityLog.value]
    next[index] = { ...next[index], ...entry }
    activityLog.value = next
  }

async function sendMessage(content: string, opts: BusinessContextOptions = {}) {
     const userMessage: ChatMessage = {
       id: generateId(),
       role: 'user',
       content,
       parts: [{ type: 'text', text: content }],
     }
     messages.value.push(userMessage)
     isStreaming.value = true
    activeRunId.value = null

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      parts: [],
    }
    messages.value.push(assistantMessage)
    /** Mutations must go through the reactive proxy stored in the array, or the UI never re-renders. */
    const trackedAssistant = messages.value[messages.value.length - 1]!

    abortController = new AbortController()
    let reasoning = ''
    const errorMessages: string[] = []

    try {
      const response = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
           businessId: opts.businessId,
           message: content,
           threadId: threadId.value,
           sessionId: opts.sessionId ?? sessionId.value,
           cardId: opts.cardId ?? null,
           agentName: opts.agentName ?? null,
           allowedTools: opts.allowedTools ?? null,
           skillSlugs: opts.skillSlugs ?? null,
           registeredSkillIds: opts.registeredSkillIds ?? null,
         }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(await readResponseMessage(response))
      }
      const responseThreadId = response.headers.get('X-Thread-Id')
      if (responseThreadId) threadId.value = responseThreadId
      if (!response.body) throw new Error('No response body')

      await consumeEventStream(response.body, {
        message: trackedAssistant,
        onError: (chunk) => {
          errorMessages.push(chunk.message || chunk.code || 'Agent error')
          handleStreamError(chunk)
        },
        onArtifact: notifyArtifacts,
        onSession: (id) => {
          sessionId.value = id
        },
        onRun: (id) => {
          activeRunId.value = id
        },
        onActivity: recordActivity,
        onReasoning: (text) => {
          reasoning += text
          trackedAssistant.reasoningContent = reasoning
        },
      }, () => {
        for (const toolCall of trackedAssistant.toolCalls ?? []) {
          recordActivity({
            id: toolCall.id,
            at: new Date().toISOString(),
            type: 'tool.finished',
            toolName: toolCall.name,
            status: toolCall.error ? 'failed' : 'done',
          })
        }
        saveMessageState(trackedAssistant.id, buildComponentStates(trackedAssistant))
      })
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // AbortError is expected when user cancels
      } else {
        toast.add({
          title: t('error'),
          description: error instanceof Error ? error.message : undefined,
          icon: 'i-heroicons-x-circle',
          color: 'error',
        })
      }
    } finally {
      finalizeAssistantMessage(trackedAssistant, errorMessages)
      isStreaming.value = false
      abortController = null
      activeRunId.value = null
      void loadThreads()
    }
  }

  /** Always run, even when the stream read throws: errors must surface in-thread. */
  function finalizeAssistantMessage(assistantMessage: ChatMessage, errorMessages: string[]) {
    const firstError = errorMessages[0]?.split('\n')[0] ?? ''
    if (!assistantMessage.content && firstError) {
      assistantMessage.content = firstError
      return
    }
    if (!assistantMessage.content && !assistantMessage.toolCalls?.length) {
      assistantMessage.content = t('emptyResponse')
    }
  }

  function buildComponentStates(message: ChatMessage): ComponentState[] {
    return (message.toolCalls ?? []).map(toolCall => ({
      id: toolCall.id,
      type: 'tool-call',
      data: { name: toolCall.name, args: toolCall.args, output: toolCall.result, isError: Boolean(toolCall.error) },
    }))
  }

  async function cancelActiveRun(): Promise<void> {
    if (isCancelling.value) return
    isCancelling.value = true
    try {
      if (activeRunId.value) {
        await $fetch(`/api/v1/agent/runs/${activeRunId.value}/cancel`, { method: 'POST' })
      }
      abortController?.abort()
      toast.add({ title: t('run.cancelled'), icon: 'i-heroicons-stop-circle', color: 'neutral' })
    }
    catch (error: unknown) {
      toast.add({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
    finally {
      isCancelling.value = false
    }
  }

  function abortStream() {
    abortController?.abort()
  }

  function isNewFormatCalls(value: unknown): value is Array<{ id: string, name: string, args?: Record<string, unknown>, result?: string, error?: string }> {
  return Array.isArray(value) && value.length > 0
    && typeof value[0] === 'object' && value[0] !== null
    && typeof (value[0] as { name?: unknown }).name === 'string'
  }

  function mapNewFormatCalls(calls: Array<{ id: string, name: string, args?: Record<string, unknown>, result?: string, error?: string }>): NonNullable<ChatMessage['toolCalls']> {
    return calls.map(tc => ({
      id: tc.id,
      name: tc.name,
      args: tc.args || {},
      result: tc.result || '',
      error: tc.error,
    }))
  }

  function mapLegacyStates(states: Array<{ id: string, data?: { name?: string, args?: Record<string, unknown>, arguments?: Record<string, unknown>, output?: string, isError?: boolean } }>): NonNullable<ChatMessage['toolCalls']> {
    return states.map(cs => ({
      id: cs.id,
      name: cs.data?.name || 'unknown',
      args: cs.data?.args || cs.data?.arguments || {},
      result: cs.data?.output || '',
      error: cs.data?.isError ? cs.data?.output : undefined,
    }))
  }

  function mapStoredComponent(c: ComponentState): NonNullable<ChatMessage['toolCalls']>[number] {
    return {
      id: c.id,
      name: c.data?.name || 'unknown',
      args: (c.data?.args as Record<string, unknown>) || {},
    }
  }

  function parseMessageMetadata(metadata: string | undefined): Record<string, unknown> {
    if (!metadata) return {}
    try {
      const parsed: unknown = JSON.parse(metadata)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }

  function parseStoredToolCalls(metadata: string | undefined): ChatMessage['toolCalls'] | undefined {
    const parsed = parseMessageMetadata(metadata)
    // New format: toolCalls is array of {id,name,args,result,error}
    if (isNewFormatCalls(parsed.toolCalls)) return mapNewFormatCalls(parsed.toolCalls)
    if (parsed.componentStates) return mapLegacyStates(parsed.componentStates)
    return undefined
  }

  function storedRun(metadata: Record<string, unknown>, toolCalls: ChatMessage['toolCalls']): MessageRunState | undefined {
    if (typeof metadata.runId !== 'string') return undefined
    const steps = (toolCalls ?? []).map(toolCall => ({
      id: toolCall.id,
      label: toolCall.name,
      status: toolCall.error ? 'failed' as const : 'done' as const,
      summary: toolCall.result?.slice(0, 120),
    }))
    return {
      id: metadata.runId,
      steps,
      approval: null,
      completed: metadata.status === 'completed',
      cancelled: metadata.cancelled === true,
    }
  }

  function storedActivity(metadata: Record<string, unknown>): ActivityEntry[] {
    const source = Array.isArray(metadata.events) ? metadata.events : metadata.toolEvents
    if (!Array.isArray(source)) return []
    return source.flatMap((raw): ActivityEntry[] => {
      if (!raw || typeof raw !== 'object') return []
      const event = raw as Record<string, unknown>
      const type = event.type
      if (type !== 'tool.started' && type !== 'tool.finished') return []
      return [{
        id: typeof event.toolCallId === 'string' ? event.toolCallId : generateId(),
        at: new Date().toISOString(),
        type,
        toolName: typeof event.toolName === 'string' ? event.toolName : undefined,
        status: type === 'tool.started' ? 'running' : event.isError ? 'failed' : 'done',
        detail: typeof event.result === 'string' ? event.result.slice(0, 120) : undefined,
      }]
    })
  }

  loadThreads = async function () {
    isLoadingThreads.value = true
    try {
      const data = await $fetch<Thread[]>('/api/ai-tools/chat/threads')
      threads.value = data || []
    } catch (error) {
      toast.add({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    } finally {
      isLoadingThreads.value = false
    }
  }

  loadThreadMessages = async function (id: string) {
    const seq = ++loadSeq
    try {
      const data = await $fetch<
        Array<{
          id: string
          role: string
          content: string
          createdAt: string
          metadata?: string
        }>
      >(`/api/ai-tools/chat/threads/${id}`)

      // A newer load started while this one was in flight — drop the stale result.
      if (seq !== loadSeq) return

      threadId.value = id
      messages.value = (data || []).map((m) => {
        const toolCalls = parseStoredToolCalls(m.metadata)
        const metadata = parseMessageMetadata(m.metadata)
        const messageState = getMessageState(m.id)
        let parts: ChatMessage['parts'] = []
        if (toolCalls && toolCalls.length > 0) {
          parts = toolCalls.map((tc) => ({ type: 'tool' as const, tool: tc.name }))
        }
        if (m.content) {
          parts.push({ type: 'text' as const, text: m.content })
        }
        if (parts.length === 0) {
          parts = [{ type: 'text' as const, text: m.content || '' }]
        }

        const resolvedToolCalls = toolCalls || (messageState?.components ? messageState.components.map(mapStoredComponent) : undefined)
        const restoredActivity = storedActivity(metadata)
        if (restoredActivity.length > 0) activityLog.value = [...activityLog.value, ...restoredActivity]
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          metadata: { kind: typeof metadata.kind === 'string' ? metadata.kind : undefined },
          parts,
          reasoningContent: typeof metadata.reasoning === 'string' ? metadata.reasoning : undefined,
          machineEvents: Array.isArray(metadata.events)
            ? metadata.events.filter((event): event is Record<string, unknown> => Boolean(event && typeof event === 'object'))
            : undefined,
          toolCalls: resolvedToolCalls,
          run: storedRun(metadata, resolvedToolCalls),
        }
      })
    } catch (error) {
      toast.add({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }

  async function createNewThread() {
    messages.value = []
    threadId.value = null
    sessionId.value = null
    activityLog.value = []
    localStorage.removeItem(THREAD_ID_STORAGE_KEY)
  }

  function clearActivity() {
    activityLog.value = []
  }

  function setSession(id: string | null) {
    sessionId.value = id
  }

  async function deleteThread(id: string) {
    try {
      await $fetch(`/api/ai-tools/chat/threads/${id}`, { method: 'DELETE' })
      threads.value = threads.value.filter((t) => t.id !== id)
      if (threadId.value === id) {
        await createNewThread()
      }
    } catch (error) {
      toast.add({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }

  function handleSuggestionClick(suggestion: string, opts: BusinessContextOptions = {}) {
    return sendMessage(suggestion, opts)
  }

  onMounted(async () => {
    const savedThreadId = localStorage.getItem(THREAD_ID_STORAGE_KEY)
    if (savedThreadId) {
      threadId.value = savedThreadId
      await loadThreadMessages(savedThreadId)
    }
  })

  watch(threadId, (newThreadId) => {
    if (newThreadId) {
      localStorage.setItem(THREAD_ID_STORAGE_KEY, newThreadId)
    } else {
      localStorage.removeItem(THREAD_ID_STORAGE_KEY)
    }
  })

  return {
    messages: computed(() => messages.value),
    isStreaming: computed(() => isStreaming.value),
    threads: computed(() => threads.value),
    isLoadingThreads: computed(() => isLoadingThreads.value),
    threadId: computed(() => threadId.value),
    sessionId: computed(() => sessionId.value),
    artifactSignal: computed(() => artifactSignal.value),
    activityLog: computed(() => activityLog.value),
    sendMessage,
    abortStream,
    cancelActiveRun,
    isCancelling: computed(() => isCancelling.value),
    setSession,
    loadThreads,
    loadThreadMessages,
    createNewThread,
    deleteThread,
    clearActivity,
    handleSuggestionClick,
  }
}

async function readResponseMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: unknown, statusMessage?: unknown }
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.statusMessage === 'string' && data.statusMessage) return data.statusMessage
  }
  catch {
    // Fall through to the status fallback below
  }
  return `HTTP error: ${response.status}`
}
