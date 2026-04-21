import type { PostFilters, DateFilterType, PostStatusFilter, PostFormatFilter } from '#layers/BaseScheduler/server/utils/SchedulerTypes'

export const DATE_FILTER_OPTIONS: { label: string; value: DateFilterType }[] = [
  { label: 'Scheduled Date', value: 'scheduledAt' },
  { label: 'Created Date', value: 'createdAt' },
  { label: 'Published Date', value: 'publishedAt' }
]

export const STATUS_FILTER_OPTIONS: { label: string; value: PostStatusFilter | null }[] = [
  { label: 'All Statuses', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Published', value: 'published' },
  { label: 'Failed', value: 'failed' }
]

export const POST_FORMAT_OPTIONS: { label: string; value: PostFormatFilter | null }[] = [
  { label: 'All Formats', value: null },
  { label: 'Post', value: 'post' },
  { label: 'Reel', value: 'reel' },
  { label: 'Story', value: 'story' },
  { label: 'Short', value: 'short' }
]

export const LIMIT_OPTIONS: { label: string; value: number }[] = [
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '200', value: 200 }
]

export const PLATFORM_OPTIONS = [
  { label: 'Facebook', value: 'facebook' },
  { label: 'Twitter', value: 'twitter' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Bluesky', value: 'bluesky' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Threads', value: 'threads' },
  { label: 'Reddit', value: 'reddit' }
]

interface UsePostFiltersOptions {
  initialDateType?: DateFilterType
  initialLimit?: number
}

export const usePostFilters = (options: UsePostFiltersOptions = {}) => {
  const route = useRoute()
  const router = useRouter()

  const dateType = ref<DateFilterType>(options.initialDateType || 'scheduledAt')
  const status = ref<PostStatusFilter | null>(null)
  const startDate = ref<string>('')
  const endDate = ref<string>('')
  const postFormat = ref<PostFormatFilter | null>(null)
  const platforms = ref<string[]>([])
  const limit = ref(options.initialLimit || 25)

  const initFromQuery = () => {
    const query = route.query
    if (query.dateType) dateType.value = query.dateType as DateFilterType
    if (query.status) status.value = query.status as PostStatusFilter
    if (query.startDate) startDate.value = query.startDate as string
    if (query.endDate) endDate.value = query.endDate as string
    if (query.postFormat) postFormat.value = query.postFormat as PostFormatFilter
    if (query.platforms) platforms.value = (query.platforms as string).split(',')
    if (query.limit) limit.value = parseInt(query.limit as string)
  }

  const getFilters = (): PostFilters => {
    const filters: PostFilters = {}
    
    if (status.value) filters.status = status.value
    if (startDate.value) filters.startDate = startDate.value
    if (endDate.value) filters.endDate = endDate.value
    if (dateType.value) filters.dateType = dateType.value
    if (postFormat.value) filters.postFormat = postFormat.value
    if (platforms.value.length > 0) filters.platforms = platforms.value
    
    return filters
  }

  const getPagination = () => ({
    page: 1,
    limit: limit.value
  })

  const updateQueryParams = () => {
    const q: Record<string, string> = {}
    
    if (status.value) q.status = status.value
    if (startDate.value) q.startDate = startDate.value
    if (endDate.value) q.endDate = endDate.value
    if (dateType.value && dateType.value !== 'scheduledAt') q.dateType = dateType.value
    if (postFormat.value) q.postFormat = postFormat.value
    if (platforms.value.length > 0) q.platforms = platforms.value.join(',')
    if (limit.value && limit.value !== 25) q.limit = limit.value.toString()

    const newQuery = { ...route.query }
    const keysToRemove = ['status', 'startDate', 'endDate', 'dateType', 'postFormat', 'platforms', 'limit']
    keysToRemove.forEach(key => {
      if (!q[key]) {
        delete newQuery[key]
      }
    })

    router.push({ query: { ...newQuery, ...q } })
  }

  const resetFilters = () => {
    status.value = null
    startDate.value = ''
    endDate.value = ''
    dateType.value = 'scheduledAt'
    postFormat.value = null
    platforms.value = []
    limit.value = options.initialLimit || 25
    updateQueryParams()
  }

  const hasActiveFilters = computed(() => {
    return !!status.value || !!startDate.value || !!endDate.value || 
           !!postFormat.value || platforms.value.length > 0 || 
           (limit.value !== (options.initialLimit || 25))
  })

  const filtersCount = computed(() => {
    let count = 0
    if (status.value) count++
    if (startDate.value || endDate.value) count++
    if (postFormat.value) count++
    if (platforms.value.length > 0) count++
    if (limit.value !== (options.initialLimit || 25)) count++
    return count
  })

  return {
    dateType,
    status,
    startDate,
    endDate,
    postFormat,
    platforms,
    limit,
    getFilters,
    getPagination,
    updateQueryParams,
    resetFilters,
    hasActiveFilters,
    filtersCount,
    initFromQuery
  }
}
