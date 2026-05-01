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
    post?: {
      text: string
      hashtags: string[]
      platform: string
      character_count: number
      warning?: string
    }
    error?: string
  }>(`${backendUrl}/api/v1/social-media/generate`, {
    method: 'POST',
    body: {
      topic: body.topic,
      platform: body.platform,
      tone: body.tone || 'professional',
      include_hashtags: body.include_hashtags ?? true,
      include_cta: body.include_cta ?? false,
      additional_context: body.additional_context || '',
      max_length: body.max_length,
    },
    headers: { 'X-User-Id': user.id },
  })

  return result
})
