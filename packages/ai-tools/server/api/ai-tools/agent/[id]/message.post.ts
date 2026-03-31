import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Agent ID required' })
  }

  const body = await readBody(event)

  if (!body?.role || !body?.content) {
    throw createError({ statusCode: 400, statusMessage: 'Role and content are required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const result = await $fetch<{ message_count: number }>(
    `${backendUrl}/api/v1/agent/${id}/message`,
    {
      method: 'POST',
      body: {
        role: body.role,
        content: body.content,
        tool_name: body.tool_name || null,
      },
      headers: { 'X-User-Id': user.id },
    },
  )

  return result
})
