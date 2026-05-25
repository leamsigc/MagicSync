import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  if (!body?.base_content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Base content is required' })
  }

  if (!body?.platform?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Platform is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const result = await $fetch<{
    variations?: Array<{
      text: string
      hashtags: string[]
      character_count: number
      warning?: string
    }>
    count?: number
    error?: string
  }>(`${backendUrl}/api/v1/social-media/generate-variations`, {
    method: 'POST',
    body: {
      base_content: body.base_content,
      platform: body.platform,
      count: body.count || 3,
      variation_type: body.variation_type || 'rephrase',
    },
    headers: { 'X-User-Id': user.id },
  })

  return result
})
