import { ref, computed, watch, onMounted } from 'vue'
import { useChatHistoryState } from './useChatHistoryState'

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
  content?: string
  delta?: string
  toolName?: string
  args?: Record<string, unknown>
  toolCallId?: string
  output?: string
  errorText?: string
  finishReason?: string
}

const THREAD_ID_STORAGE_KEY = 'ai-chat-thread-id'

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function useA2UIChat() {
  const threads = ref<Thread[]>([])
  const isLoadingThreads = ref(false)
  const threadId = ref<string | null>(null)
  const isStreaming = ref(false)
  const messages = ref<ChatMessage[]>([])
  const { saveMessageState, getMessageState } = useChatHistoryState()

  let abortController: AbortController | null = null

  let loadThreads: () => Promise<void>
  let loadThreadMessages: (id: string) => Promise<void>

  async function sendMessage(content: string) {
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

    try {
      const response = await fetch('/api/ai-tools/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.value
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role,
              parts: m.parts?.map((p) => ({ type: p.type, text: p.text || '' })),
            })),
          thread_id: threadId.value,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let currentReasoning = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let newlineIndex
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex)
          buffer = buffer.slice(newlineIndex + 1)

          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const chunk: StreamChunk = JSON.parse(jsonStr)

            if (chunk.type === 'thinking' && chunk.content) {
              currentReasoning += chunk.content
              assistantMessage.reasoningContent = currentReasoning
            } else if (chunk.type === 'text' && chunk.content) {
              assistantMessage.content += chunk.content
              if (!assistantMessage.parts) assistantMessage.parts = []
              const lastPart = assistantMessage.parts[assistantMessage.parts.length - 1]
              if (lastPart?.type === 'text') {
                lastPart.text = (lastPart.text || '') + chunk.content
              } else {
                assistantMessage.parts.push({ type: 'text', text: chunk.content })
              }
            } else if (chunk.type === 'tool' && chunk.toolName) {
              if (!assistantMessage.toolCalls) assistantMessage.toolCalls = []
              assistantMessage.toolCalls.push({
                id: chunk.id || generateId(),
                name: chunk.toolName,
                args: chunk.args || {},
              })
              assistantMessage.parts = assistantMessage.parts || []
              assistantMessage.parts.push({ type: 'tool', tool: chunk.toolName })
            } else if (chunk.type === 'tool_result' && chunk.output) {
              const toolCall = assistantMessage.toolCalls?.find((tc) => tc.id === chunk.toolCallId)
              if (toolCall) {
                toolCall.result = chunk.output
                if (chunk.errorText) toolCall.error = chunk.errorText
              }
            } else if (chunk.type === 'error') {
              console.error('Stream error:', chunk.content)
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      isLoadingThreads.value = false
      if (!threadId.value) {
        loadThreads().then(() => {
          if (threads.value.length === 1 && threads.value[0]) {
            threadId.value = threads.value[0].id
            localStorage.setItem(THREAD_ID_STORAGE_KEY, threadId.value)
          }
        })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Chat error:', err)
      }
    } finally {
      isStreaming.value = false
      abortController = null
    }
  }

  loadThreads = async function () {
    isLoadingThreads.value = true
    try {
      const data = await $fetch<Thread[]>('/api/ai-tools/chat/threads')
      threads.value = data || []
    } catch (e) {
      console.error('Failed to load threads:', e)
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
        let metadata: Record<string, unknown> | undefined
        let toolCalls: ChatMessage['toolCalls'] | undefined

        if (m.metadata) {
          try {
            const parsed = JSON.parse(m.metadata)
            metadata = parsed
            if (parsed.componentStates) {
              toolCalls = parsed.componentStates.map((cs: any) => ({
                id: cs.id,
                name: cs.data?.name || 'unknown',
                args: cs.data?.args || {},
              }))
            }
          } catch {
            // ignore
          }
        }

        const messageState = getMessageState(m.id)

        return {
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          parts: [{ type: 'text' as const, text: m.content }],
          toolCalls: toolCalls || (messageState?.components ? messageState.components.map((c: any) => ({
            id: c.id,
            name: c.data?.name || 'unknown',
            args: c.data?.args || {},
          })) : undefined),
        }
      })
    } catch (e) {
      console.error('Failed to load thread messages:', e)
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
    } catch (e) {
      console.error('Failed to delete thread:', e)
    }
  }

  function handleSuggestionClick(suggestion: string) {
    sendMessage(suggestion)
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
    sendMessage,
    loadThreads,
    loadThreadMessages,
    createNewThread,
    deleteThread,
    handleSuggestionClick,
  }
}