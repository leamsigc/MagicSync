import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

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
    headers: { 'X-User-Id': user.id },
  })

  return result
})
