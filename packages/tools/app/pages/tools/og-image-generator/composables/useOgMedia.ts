type PexelsPhoto = {
  id: number
  src: { large: string, medium: string, small: string }
  alt: string
  photographer: string
}

type AssetItem = {
  id: string
  url: string
  originalName: string
  mimeType: string
}

export function useOgMedia() {
  const { loggedIn, fetchSession } = UseUser()
  const toast = useToast()
  const { t } = useI18n()

  const pexelsQuery = ref('')
  const pexelsPhotos = ref<PexelsPhoto[]>([])
  const pexelsLoading = ref(false)
  const pexelsSearched = ref(false)

  const myAssets = ref<AssetItem[]>([])
  const assetsLoading = ref(false)

  const searchPexels = async () => {
    if (!pexelsQuery.value.trim()) return
    pexelsLoading.value = true
    try {
      const res = await $fetch<{ photos: PexelsPhoto[] }>('/api/v1/assets/pexel', {
        query: { query: pexelsQuery.value, per_page: 15 }
      })
      pexelsPhotos.value = res.photos || []
      pexelsSearched.value = true
    } catch {
      toast.add({ title: t('pexels_error'), color: 'error' })
    } finally {
      pexelsLoading.value = false
    }
  }

  const loadMyAssets = async () => {
    if (!loggedIn.value) {
      await fetchSession()
    }
    if (!loggedIn.value) return
    assetsLoading.value = true
    try {
      const res = await $fetch<{ success: boolean, data: AssetItem[] }>('/api/v1/assets', {
        query: { own: 'true', limit: 60 }
      })
      myAssets.value = (res.data || []).filter(a => a.mimeType.startsWith('image/'))
    } catch {
      toast.add({ title: t('assets_load_error'), color: 'error' })
    } finally {
      assetsLoading.value = false
    }
  }

  return {
    loggedIn,
    pexelsQuery,
    pexelsPhotos,
    pexelsLoading,
    pexelsSearched,
    myAssets,
    assetsLoading,
    searchPexels,
    loadMyAssets
  }
}
