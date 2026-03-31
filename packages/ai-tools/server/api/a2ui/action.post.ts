import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.action) {
    throw createError({ statusCode: 400, statusMessage: 'Action is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  // Build a system-readable message from the A2UI action
  const actionMessage = `[A2UI Action] ${body.action} on component ${body.componentId || 'unknown'} (surface: ${body.surfaceId || 'default'})${body.payload ? ` with data: ${JSON.stringify(body.payload)}` : ''}`

  // Forward the action to the Python backend as a chat message
  const response = await $fetch(`${backendUrl}/api/v1/chat/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': user.id,
    },
    body: {
      messages: [
        { role: 'user', content: actionMessage },
      ],
      model: 'llama3.2',
      temperature: 0.3,
    },
  })

  return {
    action: body.action,
    componentId: body.componentId,
    response: response?.message?.content || '',
  }
})
