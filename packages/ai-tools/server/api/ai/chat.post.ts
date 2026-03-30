import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

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
      thread_id: body.thread_id,
    },
    responseType: 'stream',
  })

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  return response
})
