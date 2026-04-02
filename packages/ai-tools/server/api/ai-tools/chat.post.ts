import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { generateId } from '@ai-sdk/provider-utils'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  const messages = body?.messages || []
  if (!messages.length) {
    throw createError({ statusCode: 400, statusMessage: 'Messages are required' })
  }

  // Convert AI SDK UIMessage format to Python backend format
  const convertedMessages = messages
    .map((m: any) => {
      const content = m.parts
        ? m.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('')
        : m.content || ''
      return { role: m.role, content }
    })
    .filter((m: any) => !(m.role === 'assistant' && !m.content?.trim()))

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const llmConfigResult = await userLlmConfigService.getDefaultConfig(user.id)
  const llmConfig = llmConfigResult.data ?? null
  const llmJwt = createLlmJwt(user.id, user.email || '', llmConfig)

  let threadId = body.thread_id as string | undefined
  if (!threadId) {
    const firstUserMsg = convertedMessages.find((m: any) => m.role === 'user')
    const title = firstUserMsg?.content?.slice(0, 80) || 'New Chat'
    const threadResult = await chatService.createThread(user.id, { title })
    if (threadResult.data) {
      threadId = threadResult.data.id
    }
  }

  // Persist user message
  const lastMessage = convertedMessages[convertedMessages.length - 1]
  if (threadId && lastMessage?.role === 'user') {
    await chatService.addMessage({
      threadId,
      userId: user.id,
      role: 'user',
      content: lastMessage.content,
    })
  }

  if (threadId) {
    setResponseHeader(event, 'X-Thread-Id', threadId)
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let assistantContent = ''

      try {
        const backendResponse = await fetch(`${backendUrl}/api/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmJwt}`,
          },
          body: JSON.stringify({ messages: convertedMessages, thread_id: threadId }),
        })

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text()
          writer.write({ type: 'error', errorText })
          return
        }

        if (!backendResponse.body) {
          writer.write({ type: 'error', errorText: 'No response body' })
          return
        }

        writer.write({ type: 'start-step' })

        const textId = generateId()
        writer.write({ type: 'text-start', id: textId })

        const reader = backendResponse.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const json = line.slice(12)
            if (json === '[DONE]') continue

            try {
              const data = JSON.parse(json)
              if (data.error) {
                writer.write({ type: 'error', errorText: data.error })
              } else if (data.done) {
                // stream done
              } else if (data.content) {
                assistantContent += data.content
                writer.write({ type: 'text-delta', delta: data.content, id: textId })
              }
            } catch {
              // skip invalid JSON
            }
          }
        }

        writer.write({ type: 'text-end', id: textId })
        writer.write({ type: 'finish-step' })
        writer.write({ type: 'finish', finishReason: 'stop' })
      } catch (err: any) {
        writer.write({ type: 'error', errorText: err.message })
      }

      // Persist assistant message (best-effort)
      if (threadId && assistantContent) {
        try {
          await chatService.addMessage({
            threadId,
            userId: user.id,
            role: 'assistant',
            content: assistantContent,
          })
        } catch {
          // best-effort persistence
        }
      }
    },
  })

  return createUIMessageStreamResponse({ stream })
})
