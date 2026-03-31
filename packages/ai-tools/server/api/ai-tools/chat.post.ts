import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.messages?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Messages are required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  // Ensure thread exists or create one
  let threadId = body.thread_id as string | undefined
  if (!threadId) {
    // Auto-create thread from first user message
    const firstUserMsg = body.messages.find((m: any) => m.role === 'user')
    const title = firstUserMsg?.content?.slice(0, 80) || 'New Chat'
    const threadResult = await chatService.createThread(user.id, { title })
    if (threadResult.data) {
      threadId = threadResult.data.id
    }
  }

  // Persist user message
  const lastMessage = body.messages[body.messages.length - 1]
  if (threadId && lastMessage?.role === 'user') {
    await chatService.addMessage({
      threadId,
      userId: user.id,
      role: 'user',
      content: lastMessage.content,
    })
  }

  // Stream response from Python backend
  const response = await $fetch(`${backendUrl}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': user.id,
      'X-User-Email': user.email || '',
    },
    body: {
      messages: body.messages,
      model: body.model || 'llama3.2',
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 2048,
      thread_id: threadId,
    },
    responseType: 'stream',
  })

  // Collect assistant response for persistence
  let assistantContent = ''

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  // Wrap the stream to collect assistant content while streaming
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const originalStream = response as ReadableStream

  const wrappedStream = new ReadableStream({
    async start(controller) {
      const reader = originalStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          // Parse SSE events to extract assistant content
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const chunk = JSON.parse(line.slice(6))
                if (chunk.content) {
                  assistantContent += chunk.content
                }
              } catch {
                // Not JSON, pass through
              }
            }
          }

          controller.enqueue(value)
        }

        // Persist assistant message after stream completes
        if (threadId && assistantContent) {
          await chatService.addMessage({
            threadId,
            userId: user.id,
            role: 'assistant',
            content: assistantContent,
          })
        }
      } catch (error: any) {
        // Stream error — still try to persist what we have
        if (threadId && assistantContent) {
          await chatService.addMessage({
            threadId,
            userId: user.id,
            role: 'assistant',
            content: assistantContent,
          })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(wrappedStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Thread-Id': threadId || '',
    },
  })
})
