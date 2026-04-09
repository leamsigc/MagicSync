import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { generateId } from '@ai-sdk/provider-utils'

const logger = {
  info: (...args: any[]) => console.log('[chat.api]', ...args),
  error: (...args: any[]) => console.error('[chat.api]', ...args),
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  const messages = body?.messages || []
  if (!messages.length) {
    throw createError({ statusCode: 400, statusMessage: 'Messages are required' })
  }

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
      let reasoningContent = ''
      let reasoningId: string | null = null
      let textId: string | null = null
      let toolCallIds: string[] = []
      const componentStates: { id: string; type: string; data: any }[] = []

      try {
        const backendResponse = await fetch(`${backendUrl}/api/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmJwt}`,
          },
          body: JSON.stringify({ messages: convertedMessages, thread_id: threadId }),
        })
        logger.info('Backend response status:', backendResponse.status)

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text()
          logger.error('Backend error:', errorText)
          writer.write({ type: 'error', errorText })
          return
        }

        if (!backendResponse.body) {
          writer.write({ type: 'error', errorText: 'No response body' })
          return
        }

        const reader = backendResponse.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        logger.info('Starting to read stream from backend')

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            // Process any remaining buffer
            if (buffer.startsWith('data: ')) {
              const json = buffer.slice(6).trim()
              if (json) {
                try {
                  const data = JSON.parse(json)
                  if (data.done) break
                } catch (e) {
                  logger.error('Failed to parse final SSE data:', e, json)
                }
              }
            }
            logger.info('Stream completed (done)')
            break
          }

          buffer += decoder.decode(value, { stream: true })
          
          // Process all complete SSE messages
          let newlineIndex
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex)
            buffer = buffer.slice(newlineIndex + 1)
            
            if (!line.startsWith('data: ')) continue
            const json = line.slice(6).trim()
            if (!json) continue

            // Skip if JSON looks incomplete (unclosed braces, cut-off strings)
            const openBraces = (json.match(/{/g) || []).length
            const closeBraces = (json.match(/}/g) || []).length
            if (openBraces > closeBraces || json.endsWith('"')) {
              // Put it back to buffer and wait for more data
              buffer = 'data: ' + json + '\n' + buffer
              break
            }

            try {
              const data = JSON.parse(json)
              
              if (data.type === 'thinking') {
                if (!reasoningId) {
                  reasoningId = generateId()
                  writer.write({ type: 'reasoning-start', id: reasoningId })
                }
                reasoningContent += data.content
                writer.write({ type: 'reasoning-delta', delta: data.content, id: reasoningId })
              } else if (data.type === 'text' && data.content) {
                if (!textId) {
                  textId = generateId()
                  writer.write({ type: 'text-start', id: textId })
                }
                assistantContent += data.content
                writer.write({ type: 'text-delta', delta: data.content, id: textId })
              } else if (data.type === 'tool_call' && data.tool_call) {
                const toolCallId = generateId()
                toolCallIds.push(toolCallId)
                componentStates.push({ id: toolCallId, type: 'tool-call', data: { name: data.tool_call.name, args: data.tool_call.arguments } })
                writer.write({
                  type: 'tool-call',
                  toolCallId,
                  toolName: data.tool_call.name,
                  args: JSON.parse(data.tool_call.arguments),
                } as any)
              } else if (data.type === 'tool_result' && data.tool_result) {
                writer.write({
                  type: 'tool-result',
                  toolCallId: data.tool_result.id,
                  toolName: 'unknown',
                  input: {},
                  output: data.tool_result.result,
                } as any)
              } else if (data.type === 'error') {
                writer.write({ type: 'error', errorText: data.content })
              } else if (data.done) {
                // End current step
              }
            } catch (e) {
              logger.error('Failed to parse SSE data:', e, json)
            }
          }
        }

        if (reasoningId) {
          writer.write({ type: 'reasoning-end', id: reasoningId })
        }
        if (textId) {
          writer.write({ type: 'text-end', id: textId })
        }
        writer.write({ type: 'finish', finishReason: 'stop' })
      } catch (err: any) {
        logger.error('Stream error:', err)
        writer.write({ type: 'error', errorText: err.message })
      }

      if (threadId && assistantContent) {
        try {
          await chatService.addMessage({
            threadId,
            userId: user.id,
            role: 'assistant',
            content: assistantContent,
            metadata: componentStates.length > 0 ? { componentStates } : undefined,
          })
        } catch {
          // best-effort
        }
      }
    },
  })

  return createUIMessageStreamResponse({ stream })
})