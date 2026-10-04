// Test stub for #layers/BaseShared/server/types/errors. The real module uses
// TypeScript parameter properties, which Node's strip-only mode cannot parse.
// Behavior-compatible plain implementation for service tests.
export class ServiceError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class ValidationError extends ServiceError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
    this.field = field
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}
