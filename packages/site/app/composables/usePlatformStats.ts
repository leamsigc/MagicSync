/**
 * Composable for platform statistics — wraps /api/v1/stats endpoints
 */

export interface PlatformStats {
  platform: string
  accountId: string
  username: string
  picture?: string
  fetchedAt: string
  followers?: number
  following?: number
  posts?: number
  engagement?: {
    total: number
    likes?: number
    comments?: number
    shares?: number
    views?: number
    reach?: number
    impressions?: number
  }
  growth?: {
    followers?: { absolute: number; percentage: number }
    following?: { absolute: number; percentage: number }
    posts?: { absolute: number; percentage: number }
    engagement?: { absolute: number; percentage: number }
  }
  extra?: Record<string, unknown>
}

export interface StatsFilters {
  businessId?: string
  platform?: string
  accountId?: string
  startDate?: string
  endDate?: string
}

export interface TimeSeriesData {
  labels: string[]
  datasets: { platform: string; data: number[] }[]
}

export interface AggregatedPlatform {
  platform: string
  totalFollowers: number
  totalPosts: number
  totalEngagement: number
  accounts: number
}

export const usePlatformStats = () => {
  const stats = ref<PlatformStats[]>([])
  const aggregated = ref<Record<string, AggregatedPlatform>>({})
  const timeSeries = ref<TimeSeriesData>({ labels: [], datasets: [] })
  const loading = ref(false)
  const collecting = ref(false)
  const error = ref<string>('')

  const apiBase = '/api/v1/stats'

  // Fetch current stats for all accounts
  const fetchStats = async (filters: StatsFilters = {}) => {
    try {
      loading.value = true
      error.value = ''
      const res = await $fetch<{ success: boolean; data: PlatformStats[] }>(apiBase, {
        query: { ...filters, mode: 'current' },
      })
      if (res.success) stats.value = res.data
    } catch (err: any) {
      error.value = err.data?.message || 'Failed to fetch stats'
      // Consider using a proper logging library in production
    } finally {
      loading.value = false
    }
  }

  // Fetch aggregated stats by platform
  const fetchAggregated = async (filters: StatsFilters = {}) => {
    try {
      loading.value = true
      error.value = ''
      const res = await $fetch<{ success: boolean; data: Record<string, AggregatedPlatform> }>(apiBase, {
        query: { ...filters, mode: 'aggregated' },
      })
      if (res.success) aggregated.value = res.data
    } catch (err: any) {
      error.value = err.data?.message || 'Failed to fetch aggregated stats'
      // Consider using a proper logging library in production
    } finally {
      loading.value = false
    }
  }

  // Fetch time-series data for charts
  const fetchTimeSeries = async (
    filters: StatsFilters & { days?: number; metric?: 'followers' | 'posts' | 'engagement' } = {}
  ) => {
    try {
      loading.value = true
      error.value = ''
      const res = await $fetch<{ success: boolean; data: TimeSeriesData }>(apiBase, {
        query: { ...filters, mode: 'timeseries', days: filters.days || 30 },
      })
      if (res.success) timeSeries.value = res.data
    } catch (err: any) {
      error.value = err.data?.message || 'Failed to fetch time series'
      // Consider using a proper logging library in production
    } finally {
      loading.value = false
    }
  }

  // Trigger stats collection for all accounts
  const collectStats = async (filters: StatsFilters = {}) => {
    try {
      collecting.value = true
      error.value = ''
      const res = await $fetch<{
        success: boolean
        data: { total: number; successful: number; failed: number }
      }>('/api/v1/stats/collect', {
        method: 'POST',
        body: filters,
      })
      if (res.success) {
        // Refresh current stats after collection
        await fetchStats(filters)
      }
      return res.data
    } catch (err: any) {
      error.value = err.data?.message || 'Failed to collect stats'
      // Consider using a proper logging library in production
      return null
    } finally {
      collecting.value = false
    }
  }

  // Computed helpers
  const totalFollowers = computed(() =>
    stats.value.reduce((sum, s) => sum + (s.followers ?? 0), 0)
  )
  const totalPosts = computed(() =>
    stats.value.reduce((sum, s) => sum + (s.posts ?? 0), 0)
  )
  const totalEngagement = computed(() =>
    stats.value.reduce((sum, s) => sum + (s.engagement?.total ?? 0), 0)
  )

  const platforms = computed(() =>
    stats.value.map(s => s.platform)
  )

  return {
    // State
    stats: readonly(stats),
    aggregated: readonly(aggregated),
    timeSeries: readonly(timeSeries),
    loading: readonly(loading),
    collecting: readonly(collecting),
    error: readonly(error),

    // Computed
    totalFollowers,
    totalPosts,
    totalEngagement,
    platforms,

    // Methods
    fetchStats,
    fetchAggregated,
    fetchTimeSeries,
    collectStats,
  }
}
