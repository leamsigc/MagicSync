import type { BusinessProfile } from '#layers/BaseDB/db/schema'

interface GMBResponse<T> {
  success: boolean
  data?: T
}

interface GMBLocation {
  name: string
  locationName: string
  primaryPhone?: string
  primaryCategory?: { displayName: string; categoryId: string }
  websiteUri?: string
  regularHours?: {
    periods: Array<{
      openDay: string
      openTime: string
      closeDay: string
      closeTime: string
    }>
  }
  latlng?: { latitude: number; longitude: number }
  address?: {
    regionCode: string
    languageCode: string
    postalCode: string
    administrativeArea: string
    locality: string
    addressLines: string[]
  }
  profile?: { description?: string }
  [key: string]: unknown
}

interface GMBAccount {
  name: string
  accountName: string
  type?: string
  state?: string
  [key: string]: unknown
}

interface GMBAnalytics {
  [key: string]: unknown
}

interface GMBReviewStats {
  averageRating: number
  totalReviews: number
  ratingDistribution: Record<string, number>
  [key: string]: unknown
}

interface GMBTemplate {
  [key: string]: unknown
}

interface GMBCreatePostInput {
  summary: string
  topicType?: 'STANDARD' | 'EVENT' | 'OFFER'
  languageCode?: string
  callToAction?: {
    actionType: string
    url?: string
  }
  media?: Array<{
    mediaFormat: 'PHOTO'
    sourceUrl: string
  }>
  [key: string]: unknown
}

interface GMBUpdateLocationInput {
  profile?: { description?: string }
  [key: string]: unknown
}

export const useGMBManager = () => {
  const locations = ref<GMBLocation[]>([])
  const accounts = ref<GMBAccount[]>([])
  const selectedLocation = ref<GMBLocation | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const getLocations = async (businessId: string) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await $fetch<GMBResponse<GMBLocation[]>>('/api/v1/gmb/locations', {
        params: { businessId }
      })
      if (result.success) {
        locations.value = result.data || []
      }
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch locations'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const getAccounts = async (businessId: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<GMBAccount[]>>('/api/v1/gmb/accounts', {
        params: { businessId }
      })
      if (result.success) {
        accounts.value = result.data || []
      }
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch accounts'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const getLocationDetails = async (businessId: string, locationId: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<GMBLocation>>(`/api/v1/gmb/locations/${encodeURIComponent(locationId)}`, {
        params: { businessId }
      })
      if (result.success) {
        selectedLocation.value = result.data ?? null
      }
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch location details'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const updateLocation = async (businessId: string, locationId: string, locationData: GMBUpdateLocationInput, updateMask?: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<GMBLocation>>(`/api/v1/gmb/locations/${encodeURIComponent(locationId)}`, {
        method: 'PUT',
        params: { businessId },
        body: { locationData, updateMask: updateMask || 'profile.description' }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to update location'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const getAnalytics = async (businessId: string, locationName?: string, days: number = 30) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<GMBAnalytics>>('/api/v1/gmb/analytics', {
        params: { businessId, locationName: locationName || undefined, days }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch analytics'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const createPost = async (businessId: string, locationName: string, postData: GMBCreatePostInput) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<unknown>>('/api/v1/gmb/posts', {
        method: 'POST',
        body: { businessId, locationName, postData }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to create post'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const getReviews = async (businessId: string, params?: {
    page?: number
    limit?: number
    minRating?: number
    maxRating?: number
    hasResponse?: boolean
  }) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<unknown[]>>('/api/v1/gmb/reviews', {
        params: { businessId, ...params }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch reviews'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const getReviewStats = async (businessId: string, startDate?: string, endDate?: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<GMBReviewStats>>('/api/v1/gmb/reviews/stats', {
        params: { businessId, startDate, endDate }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch review stats'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const syncReviews = async (businessId: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<unknown>>('/api/v1/gmb/reviews/sync', {
        method: 'POST',
        body: { businessId }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to sync reviews'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const replyToReview = async (businessId: string, reviewId: string, response: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<unknown>>(`/api/v1/gmb/reviews/${reviewId}/response`, {
        method: 'POST',
        body: { businessId, response }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to reply to review'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const generateAIResponse = async (reviewId: string, businessContext?: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<unknown>>(`/api/v1/gmb/reviews/${reviewId}/ai-response`, {
        method: 'POST',
        body: { businessContext }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to generate AI response'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const getResponseTemplates = async (rating: number) => {
    try {
      const result = await $fetch<GMBResponse<GMBTemplate[]>>(`/api/v1/gmb/reviews/templates`, {
        params: { rating }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to get templates'
      throw e
    }
  }

  const getReviewImageUrl = (businessId: string, reviewId: string) => {
    return `/api/v1/gmb/reviews/${reviewId}/review-to-image?businessId=${businessId}`
  }

  const syncGMB = async (businessId: string) => {
    isLoading.value = true
    try {
      const result = await $fetch<GMBResponse<unknown>>('/api/v1/gmb/sync', {
        method: 'POST',
        body: { businessId }
      })
      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to sync GMB'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    locations,
    accounts,
    selectedLocation,
    isLoading,
    error,
    getLocations,
    getAccounts,
    getLocationDetails,
    updateLocation,
    getAnalytics,
    createPost,
    getReviews,
    getReviewStats,
    syncReviews,
    replyToReview,
    generateAIResponse,
    getResponseTemplates,
    getReviewImageUrl,
    syncGMB,
  }
}
