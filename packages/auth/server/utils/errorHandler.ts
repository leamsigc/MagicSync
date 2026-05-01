
import { setResponseStatus, type H3Event } from 'h3'
import { NotFoundError, ServiceError, UnauthorizedError, ValidationError } from './types'

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, any>
    timestamp: string
    requestId?: string
  }
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export interface ErrorLogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info'
  message: string
  error?: Error
  context?: Record<string, any>
  requestId?: string
  userId?: string
  endpoint?: string
}

/**
 * Default retry configuration for transient failures
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_ERROR',
    'TEMPORARY_UNAVAILABLE',
    'CONNECTION_ERROR'
  ]
}

/**
 * Error categories for better error handling
 */
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  EXTERNAL_API = 'EXTERNAL_API',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  SYSTEM = 'SYSTEM',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Enhanced error class with additional context
 */
export class AppError extends Error {
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly isRetryable: boolean
  public context?: Record<string, any>
  public readonly timestamp: Date

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isRetryable: boolean = false,
    context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
    this.category = category
    this.severity = severity
    this.isRetryable = isRetryable
    this.context = context
    this.timestamp = new Date()
  }
}

/**
 * External API error class
 */
export class ExternalAPIError extends AppError {
  constructor(
    message: string,
    public readonly apiName: string,
    public readonly apiStatusCode?: number,
    public readonly apiResponse?: any,
    isRetryable: boolean = true
  ) {
    super(
      message,
      'EXTERNAL_API_ERROR',
      502,
      ErrorCategory.EXTERNAL_API,
      ErrorSeverity.HIGH,
      isRetryable,
      { apiName, apiStatusCode, apiResponse }
    )
    this.name = 'ExternalAPIError'
  }
}

/**
 * Network error class
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(
      message,
      'NETWORK_ERROR',
      503,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      true,
      { originalError: originalError?.message }
    )
    this.name = 'NetworkError'
  }
}

/**
 * Database error class
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: Error
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      ErrorCategory.DATABASE,
      ErrorSeverity.HIGH,
      false,
      { operation, originalError: originalError?.message }
    )
    this.name = 'DatabaseError'
  }
}

/**
 * Global error handler for API routes
 */
export function createErrorHandler() {
  return (error: Error, event: H3Event): ErrorResponse => {
    const requestId = generateRequestId()
    const timestamp = new Date().toISOString()

    // Log the error
    logError({
      timestamp,
      level: 'error',
      message: error.message,
      error,
      requestId,
      endpoint: event.node.req.url,
      context: {
        method: event.node.req.method,
        // SAFE: whitelist only non-sensitive headers — never log authorization, cookie, set-cookie, x-api-key
        userAgent: event.node.req.headers['user-agent'],
        contentType: event.node.req.headers['content-type'],
        referer: event.node.req.headers['referer'],
      }
    })

    // Handle different error types
    if (error instanceof AppError) {
      setResponseStatus(event, error.statusCode)
      return {
        error: {
          code: error.code,
          message: getUserFriendlyMessage(error),
          details: error.context,
          timestamp,
          requestId
        }
      }
    }

    if (error instanceof ServiceError) {
      setResponseStatus(event, error.statusCode)
      return {
        error: {
          code: error.code,
          message: getUserFriendlyMessage(error),
          timestamp,
          requestId
        }
      }
    }

    if (error instanceof ValidationError) {
      setResponseStatus(event, 400)
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: { field: error.field },
          timestamp,
          requestId
        }
      }
    }

    if (error instanceof NotFoundError) {
      setResponseStatus(event, 404)
      return {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
          timestamp,
          requestId
        }
      }
    }

    if (error instanceof UnauthorizedError) {
      setResponseStatus(event, 401)
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: error.message,
          timestamp,
          requestId
        }
      }
    }

    // Handle unknown errors
    setResponseStatus(event, 500)
    return {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
        timestamp,
        requestId
      }
    }
  }
}

/**
 * Retry mechanism for transient failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      if (!isRetryableError(error as Error, retryConfig.retryableErrors)) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === retryConfig.maxAttempts) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelay
      )

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000

      logError({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: `Operation failed, retrying in ${jitteredDelay}ms (attempt ${attempt}/${retryConfig.maxAttempts})`,
        error: error as Error,
        context: { attempt, delay: jitteredDelay }
      })

      await sleep(jitteredDelay)
    }
  }

  throw lastError!
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  if (error instanceof AppError) {
    return error.isRetryable
  }

  if (error instanceof ExternalAPIError) {
    return error.isRetryable
  }

  if (error instanceof NetworkError) {
    return true
  }

  // Check error message or code
  const errorString = error.message.toLowerCase()
  return retryableErrors.some(retryableError =>
    errorString.includes(retryableError.toLowerCase())
  )
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof AppError) {
    return getContextualErrorMessage(error)
  }

  if (error instanceof ExternalAPIError) {
    return `We're experiencing issues connecting to ${error.apiName}. Please try again in a few moments.`
  }

  if (error instanceof NetworkError) {
    return 'Network connection issue. Please check your internet connection and try again.'
  }

  if (error instanceof DatabaseError) {
    return 'We\'re experiencing technical difficulties. Please try again later.'
  }

  if (error instanceof ValidationError) {
    return error.message
  }

  if (error instanceof NotFoundError) {
    return error.message
  }

  if (error instanceof UnauthorizedError) {
    return 'You don\'t have permission to perform this action. Please log in and try again.'
  }

  return 'An unexpected error occurred. Please try again later.'
}

/**
 * Get contextual error message based on error category
 */
function getContextualErrorMessage(error: AppError): string {
  switch (error.category) {
    case ErrorCategory.AUTHENTICATION:
      return 'Authentication failed. Please log in again.'

    case ErrorCategory.AUTHORIZATION:
      return 'You don\'t have permission to perform this action.'

    case ErrorCategory.VALIDATION:
      return error.message

    case ErrorCategory.NOT_FOUND:
      return 'The requested resource was not found.'

    case ErrorCategory.EXTERNAL_API:
      return 'We\'re experiencing issues with an external service. Please try again later.'

    case ErrorCategory.DATABASE:
      return 'We\'re experiencing technical difficulties. Please try again later.'

    case ErrorCategory.NETWORK:
      return 'Network connection issue. Please check your internet connection and try again.'

    case ErrorCategory.BUSINESS_LOGIC:
      return error.message

    default:
      return 'An unexpected error occurred. Please try again later.'
  }
}

/**
 * Error logging function
 */
export function logError(entry: ErrorLogEntry): void {
  // In production, this would send to a logging service like Winston, Pino, or external service
  const logMessage = {
    ...entry,
    stack: entry.error?.stack
  }

  if (entry.level === 'error') {
    console.error('[ERROR]', JSON.stringify(logMessage, null, 2))
  } else if (entry.level === 'warn') {
    console.warn('[WARN]', JSON.stringify(logMessage, null, 2))
  } else {
    console.info('[INFO]', JSON.stringify(logMessage, null, 2))
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: Record<string, any>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      // Enhance error with context
      if (error instanceof AppError && context) {
        error.context = { ...error.context, ...context }
      }

      throw error
    }
  }
}

/**
 * Create error monitoring utilities
 */
export class ErrorMonitor {
  private static errorCounts = new Map<string, number>()
  private static lastReset = Date.now()
  private static readonly RESET_INTERVAL = 60 * 60 * 1000 // 1 hour

  static recordError(error: Error): void {
    const key = error.constructor.name
    const current = this.errorCounts.get(key) || 0
    this.errorCounts.set(key, current + 1)

    // Reset counts periodically
    if (Date.now() - this.lastReset > this.RESET_INTERVAL) {
      this.errorCounts.clear()
      this.lastReset = Date.now()
    }
  }

  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts)
  }

  static isErrorRateHigh(errorType: string, threshold: number = 10): boolean {
    return (this.errorCounts.get(errorType) || 0) > threshold
  }
}
