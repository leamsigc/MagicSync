export interface OAuthGrantItem {
  id: string
  clientId: string
  clientName: string | null
  scopes: string[]
  businessId: string | null
  createdAt: string | null
  updatedAt: string | null
}

export function useOAuthGrants() {
  const grants = useState<OAuthGrantItem[]>('oauth-grants:list', () => [])
  const loading = useState<boolean>('oauth-grants:loading', () => false)
  const error = useState<string | null>('oauth-grants:error', () => null)

  const fetchGrants = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const response = await $fetch<{ data: OAuthGrantItem[] }>('/api/v1/oauth/grants')
      grants.value = response.data || []
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch connected apps'
    }
    finally {
      loading.value = false
    }
  }

  const revokeGrant = async (id: string): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      await $fetch('/api/v1/oauth/grants/revoke', { method: 'POST', body: { id } })
      grants.value = grants.value.filter(g => g.id !== id)
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to revoke access'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  return { grants, loading, error, fetchGrants, revokeGrant }
}
