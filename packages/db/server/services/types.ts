/**
 * Core service types and interfaces for the social media management platform
 */

export interface ServiceResponse<T = any> {
  data?: T
  error?: string
  code?: string
}

// Folder types
export type Folder = {
  id: string
  userId: string | null
  name: string
  parentId: string | null
  path: string
  isGlobal: boolean
  createdAt: Date
}

export interface FolderCreateInput {
  name: string
  parentId?: string
  path: string
  isGlobal?: boolean
}

export interface FolderUpdateInput {
  name?: string
  parentId?: string
}

export interface PaginationOptions {
  page: number
  limit: number
  offset?: number
}

export interface PaginatedResponse<T> extends ServiceResponse<T[]> {
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface SortOptions {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterOptions {
  [key: string]: any
}

export interface QueryOptions {
  pagination?: PaginationOptions
  sort?: SortOptions
  filters?: FilterOptions
}

// Platform-specific types
export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'google_my_business'

export interface PlatformCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scope?: string
}

export interface PostContent {
  text: string
  mediaUrls?: string[]
  scheduledAt?: Date
}

export interface PublishResult {
  platform: SocialPlatform
  platformPostId?: string
  success: boolean
  error?: string
}

// Error types
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}
