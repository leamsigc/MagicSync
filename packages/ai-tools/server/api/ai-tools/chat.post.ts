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

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const llmConfigResult = await userLlmConfigService.getDefaultConfig(user.id)
  const llmConfig = llmConfigResult.data ?? null
  const llmJwt = createLlmJwt(user.id, user.email || '', llmConfig)

  let threadId = body.thread_id as string | undefined

  if (!threadId && messages.length > 0) {
    const firstUserMsg = messages.find((m: any) => m.role === 'user')
    const content = firstUserMsg?.parts
      ? firstUserMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
      : firstUserMsg?.content || ''
    const title = content?.slice(0, 80) || 'New Chat'
    const threadResult = await chatService.createThread(user.id, { title })
    if (threadResult.data) {
      threadId = threadResult.data.id
    }
  }

  const lastMessage = messages[messages.length - 1]
  if (threadId && lastMessage?.role === 'user') {
    const content = lastMessage.parts
      ? lastMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
      : lastMessage.content || ''
    await chatService.addMessage({
      threadId,
      userId: user.id,
      role: 'user',
      content,
    })
  }

  logger.info('Forwarding to backend, threadId:', threadId)

  const backendResponse = await fetch(`${backendUrl}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmJwt}`,
    },
    body: JSON.stringify({ messages: body.messages, thread_id: threadId }),
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