import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'
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
  const enableTools = body?.enable_tools !== false // Default to true

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

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const encoder = new TextEncoder()
  let assistantContent = ''
  const componentStates: { id: string; type: string; data: any }[] = []

  const sendChunk = (data: Record<string, unknown>) => {
    return `data: ${JSON.stringify(data)}\n\n`
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const backendResponse = await fetch(`${backendUrl}/api/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmJwt}`,
          },
          body: JSON.stringify({ 
            messages: convertedMessages, 
            thread_id: threadId,
            enable_tools: enableTools,
          }),
        })

        logger.info('Backend response status:', backendResponse.status)

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text()
          logger.error('Backend error:', errorText)
          controller.enqueue(encoder.encode(sendChunk({ type: 'error', content: errorText })))
          controller.close()
          return
        }

        if (!backendResponse.body) {
          controller.enqueue(encoder.encode(sendChunk({ type: 'error', content: 'No response body' })))
          controller.close()
          return
        }

        const reader = backendResponse.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        logger.info('Starting to read stream from backend')

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            if (buffer.startsWith('data: ')) {
              const json = buffer.slice(12).trim()
              if (json) {
                try {
                  const data = JSON.parse(json)
                  if (data.done) break
                } catch (e) {
                  logger.error('Failed to parse final SSE data:', e)
                }
              }
            }
            logger.info('Stream completed (done)')
            break
          }

          buffer += decoder.decode(value, { stream: true })

          let newlineIndex
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex)
            buffer = buffer.slice(newlineIndex + 1)

            if (!line.startsWith('data: ')) continue
            const json = line.slice(12).trim()
            if (!json) continue

            const openBraces = (json.match(/{/g) || []).length
            const closeBraces = (json.match(/}/g) || []).length
            if (openBraces > closeBraces || json.endsWith('"')) {
              buffer = 'data: ' + json + '\n' + buffer
              break
            }

            try {
              const data = JSON.parse(json)
              const toolName = data.tool_call?.name || ''
              const resultPreview = data.tool_result?.result?.substring(0, 50) || ''
              logger.info(`Passing through chunk: ${data.type} ${toolName} ${resultPreview}`)

              if (data.type === 'thinking' && data.content) {
                assistantContent += data.content
                controller.enqueue(encoder.encode(sendChunk({
                  type: 'thinking',
                  id: generateId(),
                  content: data.content,
                })))
              } else if (data.type === 'text' && data.content) {
                assistantContent += data.content
                controller.enqueue(encoder.encode(sendChunk({
                  type: 'text',
                  id: generateId(),
                  content: data.content,
                })))
              } else if (data.type === 'tool_call' && data.tool_call) {
                const toolCallId = generateId()
                componentStates.push({ id: toolCallId, type: 'tool-call', data: { name: data.tool_call.name, args: data.tool_call.arguments } })
                controller.enqueue(encoder.encode(sendChunk({
                  type: 'tool',
                  id: toolCallId,
                  toolName: data.tool_call.name,
                  args: JSON.parse(data.tool_call.arguments),
                })))
              } else if (data.type === 'tool_result' && data.tool_result) {
                logger.info('Received tool_result from backend:', data.tool_result.result?.substring(0, 100))
                const resultStr = data.tool_result.result
                const isError = resultStr?.includes('[Tool Error:')
                // Use the SAME id as the tool_call so frontend can match them
                const toolCallId = data.tool_result.id  // Use the id from backend
                
                // Add tool_result to componentStates so it's saved in DB
                componentStates.push({ 
                  id: toolCallId, 
                  type: 'tool-result', 
                  data: { 
                    name: data.tool_call?.name || 'unknown', // Try to get tool name from tool_call
                    output: resultStr,
                    isError 
                  } 
                })
                
                controller.enqueue(encoder.encode(sendChunk({
                  type: 'tool_result',
                  id: toolCallId,  // Use same ID as tool_call
                  toolCallId: toolCallId,
                  toolName: isError ? 'error' : 'unknown',
                  input: {},
                  output: resultStr,
                  errorText: isError ? resultStr : undefined,
                })))
              } else if (data.type === 'error') {
                controller.enqueue(encoder.encode(sendChunk({ type: 'error', id: generateId(), content: data.content })))
              } else if (data.done) {
                logger.info('Received done signal')
                controller.enqueue(encoder.encode(sendChunk({ type: 'done', id: generateId() })))
                break
              }
            } catch (e) {
              logger.error('Failed to parse SSE data:', e, json)
            }
          }
        }

        logger.info('Stream finished')
      } catch (err: any) {
        logger.error('Stream error:', err)
        controller.enqueue(encoder.encode(sendChunk({ type: 'error', id: generateId(), content: err.message })))
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

      controller.close()
    },
  })

  return sendStream(event, stream)
})