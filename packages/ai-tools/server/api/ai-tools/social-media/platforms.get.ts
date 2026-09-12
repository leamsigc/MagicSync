import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const llmJwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '')
  const llmJwt = llmJwtResult.data?.token ?? ''

  const result = await $fetch<Array<{
    name: string
    display_name: string
    limits: {
      platform: string
      max_length: number
      recommended_length?: number
      max_hashtags?: number
      max_images: number
      hashtag_placement: string
      link_handling: string
      supports_threads: boolean
    }
  }>>(`${backendUrl}/api/v1/social-media/platforms`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${llmJwt}` },
  })

  return result
})
