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

  async function sendMessage(content: string, enableTools: boolean = true) {
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
          enable_tools: enableTools,
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
            console.log('[Chat] Received chunk type:', chunk.type, 'toolName:', chunk.toolName, 'toolCallId:', chunk.toolCallId)

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
              console.log('[Chat] tool_result chunk:', chunk)
              // Find tool call - try by ID first, then by toolName
              let toolCall = null
              
              // First try to find by ID from the chunk itself (id field)
              toolCall = assistantMessage.toolCalls?.find((tc) => tc.id === chunk.id)
              
              // If not found, try by toolCallId from backend
              if (!toolCall && chunk.toolCallId) {
                toolCall = assistantMessage.toolCalls?.find((tc) => tc.id === chunk.toolCallId)
              }
              
              // Last resort: find by toolName (chunk.toolName when not error/unknown)
              if (!toolCall && chunk.toolName && chunk.toolName !== 'error' && chunk.toolName !== 'unknown') {
                toolCall = assistantMessage.toolCalls?.find((tc) => tc.name === chunk.toolName)
              }
              
              console.log('[Chat] Found toolCall:', toolCall, 'id:', chunk.id, 'toolCallId:', chunk.toolCallId, 'toolName:', chunk.toolName)
              console.log('[Chat] Available toolCalls:', assistantMessage.toolCalls?.map(tc => ({ id: tc.id, name: tc.name })))
              if (toolCall) {
                toolCall.result = chunk.output
                if (chunk.errorText) toolCall.error = chunk.errorText
                console.log('[Chat] Updated toolCall result:', toolCall.result)
              } else {
                console.log('[Chat] Warning: Could not find tool call for result')
              }
            } else if (chunk.type === 'error') {
              console.error('Stream error:', chunk.content)
            } else if (chunk.type === 'done') {
              console.log('[Chat] Received done signal')
            }
          } catch {
            // Skip malformed JSON
          }
        }

        // Check if we got a done signal
        if (buffer.includes('"done":true') || buffer.includes('"done" : true')) {
          console.log('[Chat] Stream completed with done signal')
          break
        }
      }

      // If stream ended without explicit done signal, check if we have results
      const toolCalls = assistantMessage.toolCalls || []
      const hasToolCalls = toolCalls.length > 0
      const hasTextContent = assistantMessage.content && assistantMessage.content.length > 0
      
      if (hasToolCalls && !hasTextContent) {
        // Tools ran but no final text - show tool results as final content
        console.log('[Chat] Tools executed but no text response, showing tool results')
        const toolOutputs = toolCalls
          .filter(tc => tc.result)
          .map(tc => `${tc.name}: ${tc.result}`)
          .join('\n')
        assistantMessage.content = `[Tool Results]\n${toolOutputs}`
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
                args: cs.data?.args || cs.data?.arguments || {},
                result: cs.data?.output || '',  // Include tool result
                error: cs.data?.isError ? cs.data?.output : undefined,
              }))
            }
          } catch {
            // ignore
          }
        }

        const messageState = getMessageState(m.id)

        // Build parts - include tool parts if there are tool calls
        let parts: ChatMessage['parts'] = []
        if (toolCalls && toolCalls.length > 0) {
          // Add tool parts for each tool call
          parts = toolCalls.map((tc) => ({ type: 'tool' as const, tool: tc.name }))
        }
        // Add text part if there's content
        if (m.content) {
          parts.push({ type: 'text' as const, text: m.content })
        }
        // If no parts, at least add the content as text
        if (parts.length === 0) {
          parts = [{ type: 'text' as const, text: m.content || '' }]
        }

        return {
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          parts,
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