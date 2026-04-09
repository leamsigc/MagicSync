import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'

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

  // Convert frontend message format to backend format
  const convertedMessages = messages.map((m: any) => {
    const content = m.parts
      ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
      : m.content || ''
    return { role: m.role, content }
  }).filter((m: any) => m.content)

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const llmConfigResult = await userLlmConfigService.getDefaultConfig(user.id)
  const llmConfig = llmConfigResult.data ?? null
  const llmJwt = createLlmJwt(user.id, user.email || '', llmConfig)

  let threadId = body.thread_id as string | undefined

  if (!threadId && convertedMessages.length > 0) {
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

  logger.info('Forwarding to backend, threadId:', threadId)

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
    logger.error('Backend error:', backendResponse.status, errorText)
    throw createError({ statusCode: backendResponse.status, statusMessage: errorText })
  }

  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  if (threadId) {
    setHeader(event, 'X-Thread-Id', threadId)
  }

  return sendStream(event, backendResponse.body!)
})