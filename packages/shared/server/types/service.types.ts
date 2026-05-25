export type ServiceResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export type PaginationOptions = {
  page?: number
  limit?: number
  offset?: number
}

export type PaginatedResponse<T> = ServiceResponse<T[]> & {
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type SortOptions = {
  field: string
  direction: 'asc' | 'desc'
}

export type FilterOptions = {
  [key: string]: unknown
}

export type QueryOptions = {
  pagination?: PaginationOptions
  sort?: SortOptions
  filters?: FilterOptions
}

export type PostResponse = {
  id: string
  postId: string
  releaseURL: string
  status: 'pending' | 'published' | 'failed'
  error?: string
}

export type Folder = {
  id: string
  userId: string | null
  name: string
  parentId: string | null
  path: string
  isGlobal: boolean
  createdAt: Date
}

export type FolderCreateInput = {
  name: string
  parentId?: string
  path: string
  isGlobal?: boolean
}

export type FolderUpdateInput = {
  name?: string
  parentId?: string
}

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'google_my_business'

export type PlatformCredentials = {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scope?: string
}

export type PostContent = {
  text: string
  mediaUrls?: string[]
  scheduledAt?: Date
}

export type PublishResult = {
  platform: SocialPlatform
  platformPostId?: string
  success: boolean
  error?: string
}
