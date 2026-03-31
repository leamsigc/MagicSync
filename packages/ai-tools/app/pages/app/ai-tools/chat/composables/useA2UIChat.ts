import { ref, computed } from 'vue'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  a2uiComponents?: any[]
  timestamp: Date
}

interface Thread {
  id: string
  title: string
  lastMessageAt: string | null
}

export function useA2UIChat() {
  const messages = ref<ChatMessage[]>([])
  const threads = ref<Thread[]>([])
  const isLoading = ref(false)
  const isLoadingThreads = ref(false)
  const error = ref<Error | null>(null)
  const threadId = ref<string | null>(null)

  async function loadThreads() {
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

  async function loadThreadMessages(id: string) {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<Array<{
        id: string
        role: string
        content: string
        createdAt: string
      }>>(`/api/ai-tools/chat/threads/${id}`)

      threadId.value = id
      messages.value = (data || []).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt),
      }))
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  async function createNewThread() {
    messages.value = []
    threadId.value = null
    error.value = null
  }

  async function deleteThread(id: string) {
    try {
      await $fetch(`/api/ai-tools/chat/threads/${id}`, { method: 'DELETE' })
      threads.value = threads.value.filter(t => t.id !== id)
      if (threadId.value === id) {
        await createNewThread()
      }
    } catch (e) {
      console.error('Failed to delete thread:', e)
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim()) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    messages.value.push(userMessage)

    isLoading.value = true
    error.value = null

    const assistantMessage = ref<ChatMessage>({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      a2uiComponents: [],
      timestamp: new Date(),
    })
    messages.value.push(assistantMessage.value)

    try {
      const response = await fetch('/api/ai-tools/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.value.map(m => ({
            role: m.role,
            content: m.content,
          })),
          thread_id: threadId.value,
        }),
      })

      // Capture thread ID from response header
      const responseThreadId = response.headers.get('X-Thread-Id')
      if (responseThreadId && !threadId.value) {
        threadId.value = responseThreadId
        // Refresh thread list
        loadThreads()
      }

      if (!response.ok) throw new Error('Chat request failed')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const json = line.slice(6)
            if (json === '[DONE]') {
              isLoading.value = false
              continue
            }
            try {
              const chunk = JSON.parse(json)
              if (chunk.done) {
                isLoading.value = false
              } else if (chunk.content) {
                assistantMessage.value.content += chunk.content
              }
              // Handle A2UI components if present
              if (chunk.a2ui_components?.length) {
                assistantMessage.value.a2uiComponents = [
                  ...(assistantMessage.value.a2uiComponents || []),
                  ...chunk.a2ui_components,
                ]
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }
    } catch (e) {
      error.value = e as Error
      isLoading.value = false
    }
  }

  function clearMessages() {
    messages.value = []
    threadId.value = null
    error.value = null
  }

  function regenerateLast() {
    const lastUserMessage = [...messages.value].reverse().find(m => m.role === 'user')
    if (lastUserMessage) {
      // Remove messages from the last user message onwards
      const idx = messages.value.findIndex(m => m.id === lastUserMessage.id)
      messages.value = messages.value.slice(0, idx)
      sendMessage(lastUserMessage.content)
    }
  }

  return {
    messages: computed(() => messages.value),
    threads: computed(() => threads.value),
    isLoading: computed(() => isLoading.value),
    isLoadingThreads: computed(() => isLoadingThreads.value),
    error: computed(() => error.value),
    threadId: computed(() => threadId.value),
    sendMessage,
    clearMessages,
    regenerateLast,
    loadThreads,
    loadThreadMessages,
    createNewThread,
    deleteThread,
  }
}
