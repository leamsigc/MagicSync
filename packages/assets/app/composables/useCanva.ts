interface CanvaAsset {
  id: string
  name: string
  thumbnailUrl: string
  mimeType: string
  downloadUrl: string
  type: string
}

interface CanvaListResponse {
  success: boolean
  assets: CanvaAsset[]
  nextPageToken?: string
  message?: string
}

interface DownloadCanvaResponse {
  success: boolean
  data: import('#layers/BaseDB/db/schema').Asset[]
  message: string
}

export const useCanva = () => {
  const assets = ref<CanvaAsset[]>([])
  const selectedAssets = ref<CanvaAsset[]>([])
  const isLoading = ref(false)
  const isDownloading = ref(false)
  const error = ref<string | null>(null)
  const nextPageToken = ref<string | undefined>(undefined)
  const query = ref('')
  const pageSize = ref(15)

  const toast = useToast()

  const clearError = () => {
    error.value = null
  }

  const listAssets = async (pageToken?: string) => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<CanvaListResponse>('/api/v1/assets/canva/list', {
        query: {
          query: query.value || undefined,
          pageSize: pageSize.value,
          pageToken: pageToken || undefined,
        },
      })
      if (!response.success) {
        throw new Error(response.message || 'Failed to list Canva assets')
      }
      if (pageToken) {
        assets.value.push(...response.assets)
      } else {
        assets.value = response.assets
      }
      nextPageToken.value = response.nextPageToken
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to list Canva assets'
      toast.add({
        title: 'Error',
        description: error.value,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    } finally {
      isLoading.value = false
    }
  }

  const searchAssets = async () => {
    await listAssets()
  }

  const loadNextPage = async () => {
    if (nextPageToken.value && !isLoading.value) {
      await listAssets(nextPageToken.value)
    }
  }

  const toggleSelectAsset = (asset: CanvaAsset) => {
    const index = selectedAssets.value.findIndex((a) => a.id === asset.id)
    if (index > -1) {
      selectedAssets.value.splice(index, 1)
    } else {
      selectedAssets.value.push(asset)
    }
  }

  const clearSelectedAssets = () => {
    selectedAssets.value = []
  }

  const hasNextPage = computed(() => !!nextPageToken.value)

  const downloadSelectedAssets = async (): Promise<import('#layers/BaseDB/db/schema').Asset[]> => {
    if (selectedAssets.value.length === 0) return []
    isDownloading.value = true
    error.value = null
    try {
      const response = await $fetch<DownloadCanvaResponse>('/api/v1/assets/canva/download', {
        method: 'POST',
        body: { assets: selectedAssets.value },
      })
      if (!response.success) {
        throw new Error(response.message || 'Failed to download assets')
      }
      toast.add({
        title: 'Success',
        description: response.message,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      clearSelectedAssets()
      return response.data
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to download assets'
      toast.add({
        title: 'Error',
        description: error.value,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
      return []
    } finally {
      isDownloading.value = false
    }
  }

  return {
    assets,
    selectedAssets,
    isLoading,
    isDownloading,
    error,
    query,
    nextPageToken,
    pageSize,
    clearError,
    listAssets,
    searchAssets,
    loadNextPage,
    toggleSelectAsset,
    clearSelectedAssets,
    downloadSelectedAssets,
    hasNextPage,
  }
}