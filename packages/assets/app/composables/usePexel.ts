import { ref, watch } from 'vue'
import { useFetch } from '#app'

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

/**
 *
 * Composable Description: Manages Pexels image search and selection.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
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

  // Watch for changes in query to automatically trigger search
  useDebounceFn(() => {
    if (query.value.length > 2) { // Trigger search if query is meaningful
      searchPhotos(query.value)
    }
  }, 1000)


  return {
    query,
    photos,
    totalResults,
    isLoading,
    error,
    selectedPhotos,
    searchPhotos,
    loadMore,
    toggleSelectPhoto,
    clearSelectedPhotos,
  }
}
