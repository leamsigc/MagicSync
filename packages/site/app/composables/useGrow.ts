export interface GrowRecommendation {
  did: string
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  followersCount?: number
  reason: 'follow-back' | 'suggested'
  score: number
}

export interface GrowAccount {
  id: string
  platform: string
  accountId: string
  accountName: string
}

export function useGrow() {
  const accounts = useState<GrowAccount[]>('grow-accounts', () => [])
  const recommendations = useState<GrowRecommendation[]>('grow-recommendations', () => [])
  const loading = useState<boolean>('grow-loading', () => false)
  const error = useState<string | null>('grow-error', () => null)
  const followingDid = useState<string | null>('grow-following', () => null)

  async function fetchAccounts() {
    loading.value = true
    error.value = null
    try {
      const list = await $fetch<GrowAccount[]>('/api/v1/social-accounts')
      accounts.value = (list || []).filter((a) => a.platform === 'bluesky')
    } catch (err) {
      error.value = String(err)
    } finally {
      loading.value = false
    }
  }

  async function fetchRecommendations(accountId: string) {
    loading.value = true
    error.value = null
    try {
      const response = await $fetch<{ success: boolean; data: { recommendations: GrowRecommendation[] } }>(
        `/api/v1/accounts/${accountId}/grow`,
      )
      if (response.success) {
        recommendations.value = response.data.recommendations
      }
    } catch (err) {
      error.value = String(err)
      recommendations.value = []
    } finally {
      loading.value = false
    }
  }

  async function followAccount(accountId: string, did: string) {
    followingDid.value = did
    error.value = null
    try {
      await $fetch(`/api/v1/accounts/${accountId}/grow/follow`, {
        method: 'POST',
        body: { did },
      })
      recommendations.value = recommendations.value.filter((r) => r.did !== did)
    } catch (err) {
      error.value = String(err)
      throw err
    } finally {
      followingDid.value = null
    }
  }

  return {
    accounts,
    recommendations,
    loading,
    error,
    followingDid,
    fetchAccounts,
    fetchRecommendations,
    followAccount,
  }
}
