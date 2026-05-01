import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const result = await $fetch<{
    thread?: Array<{
      text: string
      hashtags: string[]
      character_count: number
      tweet_number: number
      warning?: string
    }>
    tweet_count?: number
    error?: string
  }>(`${backendUrl}/api/v1/social-media/generate-thread`, {
    method: 'POST',
    body: {
      topic: body.topic,
      platform: body.platform || 'twitter',
      tweet_count: body.tweet_count || 5,
      hook_first: body.hook_first ?? true,
    },
    headers: { 'X-User-Id': user.id },
  })

  return result
})
