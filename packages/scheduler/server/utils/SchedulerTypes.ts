
export interface PostFilters {
  status?: string
  startDate?: string
  endDate?: string
}

export interface PlatformPostStatus {
  platform: string
  status: 'pending' | 'published' | 'failed'
  errorMessage?: string
  publishedAt?: string
}

export interface PostWithPlatformStatus {
  post: any
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
