import type { GoalErrorKind } from './contracts'

const RETRYABLE_CODES = new Set([
  'PROVIDER_FAILED',
  'FETCH_FAILED',
  'LANGSEARCH_FAILED',
  'RESEARCH_ERROR',
  'TIMEOUT',
])

const USER_ACTION_CODES = new Set([
  'MODEL_NOT_CONFIGURED',
  'MODEL_UNAVAILABLE',
  'MODEL_NOT_AVAILABLE',
  'LANGSEARCH_NOT_CONFIGURED',
  'FORBIDDEN',
  'NOT_FOUND',
])

/** Map a failure to the agentic recovery strategy. Bounded by the caller. */
export function classifyError(message: string, code?: string): GoalErrorKind {
  if (code && USER_ACTION_CODES.has(code)) return 'requires-user'
  if (code === 'SKILL_OUTPUT_INVALID' || code === 'VALIDATION_ERROR') return 'recoverable'
  if (code && RETRYABLE_CODES.has(code)) return 'retryable'
  const normalized = message.toLowerCase()
  if (/\btimeout\b|econn|socket|network|temporar/.test(normalized)) return 'retryable'
  if (/not configured|permission|unauthori[sz]ed/.test(normalized)) return 'requires-user'
  return 'fatal'
}

export interface RecoveryOptions {
  maxRetries?: number
  onRetry?: (attempt: number, error: string) => void
}

/**
 * Run a task with bounded recovery: retryable and recoverable failures are
 * retried up to maxRetries; everything else returns immediately.
 */
export async function runWithRecovery<T>(
  task: () => Promise<ServiceResponse<T>>,
  options: RecoveryOptions = {},
): Promise<ServiceResponse<T>> {
  const maxRetries = options.maxRetries ?? 2
  let last = await task()
  for (let attempt = 1; attempt <= maxRetries && !last.success; attempt += 1) {
    const kind = classifyError(last.error, last.code)
    if (kind !== 'retryable' && kind !== 'recoverable') return last
    options.onRetry?.(attempt, last.error)
    last = await task()
  }
  return last
}
