interface PexelsPhoto {
  id: number
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  photographer_id: number
  avg_color: string
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    portrait: string
    landscape: string
    tiny: string
  }
  liked: boolean
  alt: string
}

interface PexelsSearchResponse {
  page: number
  per_page: number
  photos: PexelsPhoto[]
  total_results: number
  next_page: string
}

export const usePexel = () => {
  const query = ref('')
  const currentPage = ref(1)
  const perPage = ref(15)
  const photos = ref<PexelsPhoto[]>([])
  const totalResults = ref(0)
  const isLoading = ref(false)
  const error = ref<any>(null)
  const selectedPhotos = ref<PexelsPhoto[]>([])

  const searchPhotos = async (newQuery?: string) => {
    if (newQuery !== undefined) {
      query.value = newQuery
      currentPage.value = 1
    }

    if (!query.value) {
      photos.value = []
      totalResults.value = 0
      return
    }

    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<PexelsSearchResponse>(
        `/api/v1/assets/pexel`,
        {
          method: 'GET',
          query: {
            query: query.value,
            page: currentPage.value,
            per_page: perPage.value,
          },
        },
      )

      photos.value = response.photos
      totalResults.value = response.total_results
    } catch (e) {
      error.value = e
      console.error('Pexels search error:', e)
    } finally {
      isLoading.value = false
    }
  }

  const loadMore = () => {
    if (photos.value.length < totalResults.value && !isLoading.value) {
      currentPage.value++
      searchPhotos()
    }
  }

  const goToPage = (page: number) => {
    if (page > 0 && page <= totalPages.value && !isLoading.value) {
      currentPage.value = page
      searchPhotos()
    }
  }

  const totalPages = computed(() => {
    return Math.ceil(totalResults.value / perPage.value) || 1
  })

  const toggleSelectPhoto = (photo: PexelsPhoto) => {
    const index = selectedPhotos.value.findIndex((p) => p.id === photo.id)
    if (index > -1) {
      selectedPhotos.value.splice(index, 1)
    } else {
      selectedPhotos.value.push(photo)
    }
  }

  const clearSelectedPhotos = () => {
    selectedPhotos.value = []
  }

  return {
    query,
    photos,
    totalResults,
    totalPages,
    isLoading,
    error,
    selectedPhotos,
    currentPage,
    perPage,
    searchPhotos,
    loadMore,
    goToPage,
    toggleSelectPhoto,
    clearSelectedPhotos,
  }
}