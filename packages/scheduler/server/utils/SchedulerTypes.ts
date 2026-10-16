
export type DateFilterType = 'scheduledAt' | 'createdAt' | 'publishedAt'
export type PostStatusFilter = 'pending' | 'published' | 'failed'
export type PostFormatFilter = 'post' | 'reel' | 'story' | 'short'
/** Relative window inside the visible range. `null` means the whole range. */
export type DateWindowFilter = 'overdue' | 'today' | 'next7' | 'later'

export interface PostFilters {
  status?: PostStatusFilter
  startDate?: string
  endDate?: string
  dateType?: DateFilterType
  postFormat?: PostFormatFilter
  platforms?: string[]
  window?: DateWindowFilter | null
  /** Floating local ISO bounds derived from `window` at apply time. */
  windowStart?: string
  windowEnd?: string
}

export interface PlatformPostStatus {
  platform: string
  status: 'pending' | 'published' | 'failed'
  errorMessage?: string
  publishedAt?: string
}

export interface PostWithPlatformStatus {
  post: Record<string, unknown>
  platformStatuses: PlatformPostStatus[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  platformStatuses?: PlatformPostStatus[]
}

export interface PostStats {
  totalPosts: number
  publishedPosts: number
  scheduledPosts: number
  failedPosts: number
  postsByPlatform: Record<string, number>
  engagementRate: number
}

export interface ValidationResult {
  isValid: boolean
  hasWarnings: boolean
  validations: Record<string, any>
  summary: {
    totalPlatforms: number
    validPlatforms: number
    invalidPlatforms: number
  }
}
