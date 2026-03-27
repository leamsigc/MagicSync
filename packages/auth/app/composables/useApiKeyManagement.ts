export interface ApiKeyListItem {
  id: string
  name: string
  prefix: string
  expiresAt: string | null
  createdAt: string
  enabled: boolean
}

export interface CreatedApiKey {
  id: string
  name: string
  key: string
  prefix: string
  expiresAt: string | null
  createdAt: string
  metadata: {
    businessId: string
    businessName: string
    connectedPlatforms: string[]
  }
}

export function useApiKeyManagement() {
  const { user } = UseUser()
  const activeBusinessId = useState<string>('business:id');

  const apiKeys = ref<ApiKeyListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const newApiKey = ref<CreatedApiKey | null>(null)
  const showKeyModal = ref(false)

  const fetchApiKeys = async (businessId?: string) => {
    const targetBusinessId = businessId || activeBusinessId.value
    if (!targetBusinessId) {
      error.value = 'No business selected'
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ apiKeys: ApiKeyListItem[]; total: number }>('/api/v1/api-keys', {
        method: 'GET',
        query: { businessId: targetBusinessId }
      })

      apiKeys.value = response.apiKeys
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch API keys'
    } finally {
      loading.value = false
    }
  }

  const createApiKey = async (name: string, businessId?: string, expiresIn?: number) => {
    const targetBusinessId = businessId || activeBusinessId.value
    if (!targetBusinessId) {
      error.value = 'No business selected'
      throw new Error('No business selected')
    }

    loading.value = true
    error.value = null

    try {
      const response = await $fetch<CreatedApiKey>('/api/v1/api-keys/create', {
        method: 'POST',
        body: {
          name,
          businessId: targetBusinessId,
          expiresIn
        }
      })

      apiKeys.value.unshift({
        id: response.id,
        name: response.name,
        prefix: response.prefix,
        expiresAt: response.expiresAt,
        createdAt: response.createdAt,
        enabled: true
      })

      newApiKey.value = response
      showKeyModal.value = true

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to create API key'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteApiKey = async (keyId: string, businessId?: string) => {
    const targetBusinessId = businessId || activeBusinessId.value
    if (!targetBusinessId) {
      error.value = 'No business selected'
      throw new Error('No business selected')
    }

    loading.value = true
    error.value = null

    try {
      await $fetch('/api/v1/api-keys/delete', {
        method: 'DELETE',
        body: {
          keyId,
          businessId: targetBusinessId
        }
      })

      apiKeys.value = apiKeys.value.filter(k => k.id !== keyId)
    } catch (err: any) {
      error.value = err.message || 'Failed to delete API key'
      throw err
    } finally {
      loading.value = false
    }
  }

  const closeKeyModal = () => {
    showKeyModal.value = false
    newApiKey.value = null
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  return {
    apiKeys,
    loading,
    error,
    newApiKey,
    showKeyModal,
    fetchApiKeys,
    createApiKey,
    deleteApiKey,
    closeKeyModal,
    copyToClipboard
  }
}
