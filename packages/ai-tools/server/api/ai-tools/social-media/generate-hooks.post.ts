import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  }

  if (!body?.platform?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Platform is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const result = await $fetch<{
    hooks?: Array<{
      hook: string
      hook_type: string
    }>
    count?: number
    error?: string
  }>(`${backendUrl}/api/v1/social-media/generate-hooks`, {
    method: 'POST',
    body: {
      topic: body.topic,
      platform: body.platform,
      count: body.count || 5,
    },
    headers: { 'X-User-Id': user.id },
  })

  return result
})
