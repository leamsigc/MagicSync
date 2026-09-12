import { aiToolsFacade } from '#layers/BaseAITools/server/services/aiToolsFacade.service';
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service';
import { generateId } from '@ai-sdk/provider-utils'

function requestBusinessId(body: Record<string, unknown> | null | undefined): string | null {
  if (typeof body?.business_id === 'string') return body.business_id
  if (typeof body?.businessId === 'string') return body.businessId
  return null
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  const messages = body?.messages || []
  const messageCount = messages.length
  log.set({ messageCount, threadId: body.thread_id })
  if (!messages.length) {
    throw createError({ statusCode: 400, statusMessage: 'Messages are required' })
  }

  interface InputMessage {
    role: string
    content?: string
    parts?: Array<{ type: string; text?: string }>
  }

  const convertedMessages = (messages as InputMessage[])
    .map((m) => {
      const content = m.parts
        ? m.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text || '')
          .join('')
        : m.content || ''
      return { role: m.role, content }
    })
    .filter((m) => !(m.role === 'assistant' && !m.content?.trim()))

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const llmJwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '', requestBusinessId(body))
  const llmJwt = llmJwtResult.data?.token ?? ''

  let threadId = body.thread_id as string | undefined
  if (!threadId) {
    const firstUserMsg = convertedMessages.find((m) => m.role === 'user')
    const title = firstUserMsg?.content?.slice(0, 80) || 'New Chat'
    const threadResult = await aiToolsFacade.createThread(user.id, { title })
    if (threadResult.data) {
      threadId = threadResult.data.id
    }
  }

  const lastMessage = convertedMessages[convertedMessages.length - 1]
  const enableTools = body?.enable_tools !== false // Default to true

  // Opt-in business context: current-edition-only, budgeted, redacted (T20).
  // Fail loudly when requested context cannot be loaded.
  const contextResult = await businessContextResolver.resolve(user.id, {
    businessId: requestBusinessId(body),
    useBusinessContext: body?.useBusinessContext === true || body?.use_business_context === true,
    includePersonalKnowledge: body?.includePersonalKnowledge === true || body?.include_personal_knowledge === true,
  }, event)
  if (!contextResult.success || !contextResult.data) {
    throw createError({ statusCode: contextErrorStatus(contextResult.code), message: contextResult.error })
  }
  const brandContext = contextResult.data
  if (brandContext.enabled && brandContext.prompt) {
    convertedMessages.unshift({ role: 'system', content: brandContext.prompt })
  }

  if (threadId && lastMessage?.role === 'user') {
    await aiToolsFacade.addMessage(user.id, {
      threadId,
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
  const componentStates: { id: string; type: string; data: Record<string, unknown> }[] = []

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
            business_id: brandContext.businessId,
            use_business_context: brandContext.enabled,
            context_edition_id: brandContext.editionId,
            business_context: brandContext.prompt || undefined,
          }),
        })

        log.info('Backend response status', { status: backendResponse.status })

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text()
          log.error('Backend error', { status: backendResponse.status, error: errorText })
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
        // Spec-compliant SSE reassembly: accumulate `data:` lines until a
        // blank line completes one event — no brace counting. Handles
        // multi-line payloads and split chunks across reads.
        let buffer = ''
        let eventLines: string[] = []

        function drainCompleteEvents(): string[] {
          const events: string[] = []
          let newlineIndex = buffer.indexOf('\n')
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).replace(/\r$/, '')
            buffer = buffer.slice(newlineIndex + 1)
            if (line === '') {
              if (eventLines.length > 0) {
                events.push(eventLines.join('\n'))
                eventLines = []
              }
            } else if (line.startsWith('data:')) {
              eventLines.push(line.slice(5).trimStart())
            }
            newlineIndex = buffer.indexOf('\n')
          }
          return events
        }

        log.info('Starting to read stream from backend', {})

        let streamDone = false
        while (!streamDone) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += '\n'
          } else {
            buffer += decoder.decode(value, { stream: true })
          }
          const payloads = drainCompleteEvents()
          if (done && buffer.trim().length === 0 && payloads.length === 0 && eventLines.length === 0) {
            log.info('Stream completed', {})
            break
          }

          for (const json of payloads) {
            if (!json) continue
            try {
              const data = JSON.parse(json)
              const toolName = data.tool_call?.name || ''
              const resultPreview = data.tool_result?.result?.substring(0, 50) || ''
              log.info('Passing through chunk', { type: data.type, toolName, resultPreview })

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
                log.info('Received tool_result from backend', { resultPreview: data.tool_result.result?.substring(0, 100) })
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
                log.info('Received done signal', {})
                controller.enqueue(encoder.encode(sendChunk({ type: 'done', id: generateId() })))
                streamDone = true
              }
            } catch (e) {
              log.error('Failed to parse SSE data', { error: String(e), json })
            }
          }
        }

        log.info('Stream finished', {})
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error('Stream error', { error: String(error) })
        controller.enqueue(encoder.encode(sendChunk({ type: 'error', id: generateId(), content: errorMessage })))
      }

      if (threadId && assistantContent) {
        try {
          await aiToolsFacade.addMessage(user.id, {
            threadId,
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
