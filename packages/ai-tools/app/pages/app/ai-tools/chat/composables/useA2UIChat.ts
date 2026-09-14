import { ref, computed, watch, onMounted } from 'vue'
import { useChatHistoryState, type ComponentState } from './useChatHistoryState'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: Array<{ type: 'text' | 'tool'; text?: string; tool?: string }>
  reasoningContent?: string
  toolCalls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
    result?: string
    error?: string
  }>
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
}

const THREAD_ID_STORAGE_KEY = 'ai-chat-thread-id'

export interface BusinessContextOptions {
  useBusinessContext?: boolean
  businessId?: string
  privateMode?: boolean
  cardId?: string
  model?: string
  agent?: string
  skill?: string
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
}

const CHUNK_HANDLERS: Record<string, (chunk: StreamChunk, ctx: ChunkContext) => void> = {
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
  },
  'tool.finished': (chunk, ctx) => {
    const toolCall = findToolCall(ctx.message, chunk)
    if (!toolCall) return
    toolCall.result = toolResultText(chunk.result)
    if (chunk.isError) toolCall.error = toolCall.result
  },
  'error': (chunk, ctx) => {
    ctx.onError(chunk)
  },
  'artifact.created': (_chunk, ctx) => {
    ctx.onArtifact()
  },
  'review.required': (_chunk, ctx) => {
    ctx.onArtifact()
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

export function useA2UIChat() {
  const { t } = useI18n()
  const toast = useToast()
  const threads = ref<Thread[]>([])
  const isLoadingThreads = ref(false)
  const threadId = ref<string | null>(null)
  const isStreaming = ref(false)
  const messages = ref<ChatMessage[]>([])
  const artifactSignal = ref(0)
  const { saveMessageState, getMessageState } = useChatHistoryState()

  let abortController: AbortController | null = null

  let loadThreads: () => Promise<void>
  let loadThreadMessages: (id: string) => Promise<void>

  function handleStreamError(chunk: StreamChunk) {
    toast.add({
      title: t('error'),
      description: chunk.message || chunk.code || 'Agent error',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }

  function notifyArtifacts() {
    artifactSignal.value += 1
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

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      parts: [],
    }
    messages.value.push(assistantMessage)

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
           cardId: opts.cardId ?? null,
           useBusinessContext: opts.useBusinessContext ?? true,
           privateMode: opts.privateMode ?? false,
           model: opts.model ?? 'gpt-4o',
           agent: opts.agent ?? 'content-writer',
           skill: opts.skill ?? '',
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
        message: assistantMessage,
        onError: (chunk) => {
          errorMessages.push(chunk.message || chunk.code || 'Agent error')
          handleStreamError(chunk)
        },
        onArtifact: notifyArtifacts,
        onReasoning: (text) => {
          reasoning += text
          assistantMessage.reasoningContent = reasoning
        },
      }, () => {
        saveMessageState(assistantMessage.id, buildComponentStates(assistantMessage))
      })

      if (!assistantMessage.content && errorMessages.length > 0) {
        assistantMessage.content = errorMessages[0] ?? ''
      }
      if (!assistantMessage.content && !assistantMessage.toolCalls?.length) {
        assistantMessage.content = t('emptyResponse')
      }
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
      isStreaming.value = false
      abortController = null
      if (!threads.value.some(thread => thread.id === threadId.value)) {
        void loadThreads()
      }
    }
  }

  function buildComponentStates(message: ChatMessage): ComponentState[] {
    return (message.toolCalls ?? []).map(toolCall => ({
      id: toolCall.id,
      type: 'tool-call',
      data: { name: toolCall.name, args: toolCall.args, output: toolCall.result, isError: Boolean(toolCall.error) },
    }))
  }

  function abortStream() {
    abortController?.abort()
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

      threadId.value = id
      messages.value = (data || []).map((m) => {
        let toolCalls: ChatMessage['toolCalls'] | undefined

        if (m.metadata) {
          try {
            const parsed = JSON.parse(m.metadata)
            if (parsed.componentStates) {
              toolCalls = (parsed.componentStates as Array<{ id: string; data?: { name?: string; args?: Record<string, unknown>; arguments?: Record<string, unknown>; output?: string; isError?: boolean } }>).map((cs) => ({
                id: cs.id,
                name: cs.data?.name || 'unknown',
                args: cs.data?.args || cs.data?.arguments || {},
                result: cs.data?.output || '',
                error: cs.data?.isError ? cs.data?.output : undefined,
              }))
            }
          } catch {
            // ignore malformed metadata
          }
        }

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

        return {
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          parts,
          toolCalls: toolCalls || (messageState?.components ? messageState.components.map((c: ComponentState) => ({
            id: c.id,
            name: c.data?.name || 'unknown',
            args: (c.data?.args as Record<string, unknown>) || {},
          })) : undefined),
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
    localStorage.removeItem(THREAD_ID_STORAGE_KEY)
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
    artifactSignal: computed(() => artifactSignal.value),
    sendMessage,
    abortStream,
    loadThreads,
    loadThreadMessages,
    createNewThread,
    deleteThread,
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
