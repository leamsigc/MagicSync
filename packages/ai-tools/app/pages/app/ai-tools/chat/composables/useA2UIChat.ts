import { ref, computed } from 'vue'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  a2uiComponents?: any[]
  timestamp: Date
}

export function useA2UIChat() {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const threadId = ref<string | null>(null)

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

      if (!response.ok) throw new Error('Chat request failed')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))

          for (const line of lines) {
            const json = line.replace('data: ', '')
            try {
              const chunk = JSON.parse(json)
              if (chunk.done) {
                isLoading.value = false
              } else if (chunk.content) {
                assistantMessage.value.content += chunk.content
              }
            } catch (e) {
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
      messages.value = messages.value.filter(m => m.id !== lastUserMessage.id)
      sendMessage(lastUserMessage.content)
    }
  }

  return {
    messages: computed(() => messages.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    threadId: computed(() => threadId.value),
    sendMessage,
    clearMessages,
    regenerateLast,
  }
}
