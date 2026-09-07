import type { Ref } from 'vue'

export interface AutoRepostConfig {
  enabled: boolean
  intervalHours: number
  maxReposts: number
  currentCount: number
  nextRepostAt?: string
}

export function useAutoRepost() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function configure(postId: string, config: { enabled: boolean; intervalHours?: number; maxReposts?: number }) {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{ success: boolean; config: AutoRepostConfig }>(
        '/api/v1/posts/auto-repost/configure',
        {
          method: 'POST',
          body: { postId, ...config },
        }
      )
      return res.config
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to configure auto-repost'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getConfig(postId: string): Promise<AutoRepostConfig | null> {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{ success: boolean; config: AutoRepostConfig }>(
        `/api/v1/posts/auto-repost/${postId}/config`
      )
      return res.config
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch auto-repost config'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    configure,
    getConfig,
  }
}
