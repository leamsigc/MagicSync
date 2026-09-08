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
    saves?: number
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

export interface PlatformGraph {
  platform: string
  accountId?: string
  accountName?: string
  labels: string[]
  followers: number[]
  posts: number[]
  engagement: number[]
  current: {
    followers: number
    following: number
    posts: number
    engagement: number
  }
}

export interface DashboardData {
  summary: {
    postsLast30Days: number
    totalFollowers: number
    totalEngagement: number
    totalPosts: number
  }
  currentStats: PlatformStats[]
  platformGraphs: PlatformGraph[]
  freshness?: FreshnessEntry[]
}

export interface FreshnessEntry {
  accountId: string
  platform: string
  accountName: string
  lastCollectedAt?: string
  nextDueAt?: string
  status: string
  consecutiveFailures: number
  lastError?: string
}

export interface TopPost {
  postId: string
  content: string
  platform: string
  accountId: string
  externalPostId?: string
  metrics: Record<string, number>
  lastCollectedAt: string
}

export interface BestTimeSlot {
  platform: string
  dayOfWeek: number
  hour: number
  avgEngagement: number
  postCount: number
}

export interface BestTimes {
  slots: BestTimeSlot[]
  topSlots: BestTimeSlot[]
  timezoneNote: string
}

export type StatsRange = 7 | 30 | 90

export const STATS_RANGES: StatsRange[] = [7, 30, 90]

export interface CollectStatsResult {
  accountId: string
  platform: string
  username: string
  success: boolean
  stats?: PlatformStats
  error?: string
}

export const usePlatformStats = () => {
  const stats = useState<PlatformStats[]>('platform-stats', () => [])
  const aggregated = useState<Record<string, AggregatedPlatform>>('platform-stats-aggregated', () => ({}))
  const timeSeries = useState<TimeSeriesData>('platform-stats-timeseries', () => ({ labels: [], datasets: [] }))
  const dashboard = useState<DashboardData | null>('platform-stats-dashboard', () => null)
  const topPosts = useState<TopPost[]>('platform-stats-top-posts', () => [])
  const bestTimes = useState<BestTimes | null>('platform-stats-best-times', () => null)
  const range = useState<StatsRange>('platform-stats-range', () => 30)
  const loading = ref(false)
  const collecting = ref(false)
  const exporting = ref(false)
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
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch stats'
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
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch aggregated stats'
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
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch time series'
    } finally {
      loading.value = false
    }
  }

  // Fetch dashboard overview data for the selected range
  const fetchDashboard = async (filters: StatsFilters & { days?: number; refresh?: boolean } = {}) => {
    try {
      loading.value = true
      error.value = ''
      const res = await $fetch<{ success: boolean; data: DashboardData }>('/api/v1/stats/dashboard', {
        query: { ...filters, days: filters.days || range.value },
      })
      if (res.success) dashboard.value = res.data
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch dashboard'
    } finally {
      loading.value = false
    }
  }

  // Fetch top performing posts for the selected range
  const fetchTopPosts = async (filters: StatsFilters & { days?: number; limit?: number } = {}) => {
    try {
      error.value = ''
      const res = await $fetch<{ success: boolean; data: TopPost[] }>(apiBase, {
        query: { ...filters, mode: 'top-posts', days: filters.days || range.value, limit: filters.limit || 5 },
      })
      if (res.success) topPosts.value = res.data
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch top posts'
    }
  }

  // Fetch best posting times for the selected range
  const fetchBestTimes = async (filters: StatsFilters & { days?: number } = {}) => {
    try {
      error.value = ''
      const res = await $fetch<{ success: boolean; data: BestTimes }>(apiBase, {
        query: { ...filters, mode: 'best-times', days: filters.days || range.value },
      })
      if (res.success) bestTimes.value = res.data
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch best times'
    }
  }

  // Change the analytics range and reload dashboard data
  const setRange = async (next: StatsRange, filters: StatsFilters = {}) => {
    range.value = next
    await Promise.all([fetchDashboard(filters), fetchTopPosts(filters), fetchBestTimes(filters)])
  }

  // Download analytics history as CSV
  const exportCsv = async (filters: StatsFilters = {}) => {
    try {
      exporting.value = true
      error.value = ''
      const blob = await $fetch<Blob>(`${apiBase}/export`, {
        query: { ...filters, days: range.value },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `analytics-${range.value}d-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      return true
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to export stats'
      return false
    } finally {
      exporting.value = false
    }
  }

  // Trigger stats collection for all accounts
  const collectStats = async (filters: StatsFilters = {}) => {
    try {
      collecting.value = true
      error.value = ''
      const res = await $fetch<{
        success: boolean
        data: { total: number; successful: number; failed: number; results: CollectStatsResult[] }
      }>('/api/v1/stats/collect', {
        method: 'POST',
        // Manual refresh always forces: due-gating is for the background
        // task. Without this, accounts in backoff report "0 of 0".
        body: { ...filters, force: true },
      })
      if (res.success) {
        await fetchStats(filters)
      }
      return res.data
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to collect stats'
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

  // Fetch comparison data (current vs previous period)
  const fetchComparison = async (filters: StatsFilters = {}) => {
    try {
      loading.value = true
      error.value = ''
      const res = await $fetch<{ success: boolean; data: { days: number; entries: { platform: string; accountId: string; username: string; current: { followers: number; following: number; posts: number; engagement: number }; previous: { followers: number; following: number; posts: number; engagement: number }; delta: { followers: number; following: number; posts: number; engagement: number } }[] } }>(apiBase, {
        query: { ...filters, mode: 'comparison', days: range.value },
      })
      if (res.success) return res.data
      return null
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch comparison'
      return null
    } finally {
      loading.value = false
    }
  }

  // Fetch post metrics history for a specific post
  const fetchPostMetrics = async (postId: string, filters: StatsFilters = {}) => {
    try {
      loading.value = true
      error.value = ''
      const res = await $fetch<{ success: boolean; data: { postId: string; platform: string; history: { date: string; metrics: Record<string, number> }[] }[] }>(`/api/v1/posts/${postId}/stats`, {
        query: { ...filters },
      })
      if (res.success) return res.data
      return []
    } catch (err: unknown) {
      const fetchError = err as { data?: { message?: string }; message?: string }
      error.value = fetchError.data?.message || fetchError.message || 'Failed to fetch post metrics'
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    stats: stats,
    aggregated: aggregated,
    timeSeries: timeSeries,
    dashboard: dashboard,
    topPosts: topPosts,
    bestTimes: bestTimes,
    range: range,
    loading: loading,
    collecting: collecting,
    exporting: exporting,
    error: error,

    // Computed
    totalFollowers,
    totalPosts,
    totalEngagement,
    platforms,

    // Methods
    fetchStats,
    fetchAggregated,
    fetchTimeSeries,
    fetchDashboard,
    fetchTopPosts,
    fetchBestTimes,
    fetchComparison,
    fetchPostMetrics,
    setRange,
    exportCsv,
    collectStats,
  }
}
