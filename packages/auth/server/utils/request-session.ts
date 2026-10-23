import type { H3Event } from 'h3'
import { getHeaders } from 'h3'
import { auth } from '#layers/BaseAuth/lib/auth'

/**
 * One Better Auth session resolution per HTTP request.
 *
 * Three independent places need the session for an authenticated `/api/v1/*`
 * call: the auth middleware (401 gate), the evlog identity middleware (wide
 * event user), and the route handler itself (ownership scoping). Each used to
 * call `auth.api.getSession()` on its own, so every API request paid three
 * session lookups (~100 ms each against the remote DB).
 *
 * The cache lives on the H3 event context, which is per-request, and stores the
 * *promise* so two concurrently-awaited callers share one in-flight lookup
 * instead of racing. Nothing outlives the request.
 */
type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

interface AuthRequestCache {
  headers?: Headers
  session?: Promise<AuthSession>
}

const CACHE_KEY = 'authRequest'

function cacheFor(event: H3Event): AuthRequestCache {
  const context = event.context as Record<string, unknown>
  const existing = context[CACHE_KEY] as AuthRequestCache | undefined
  const cache = existing ?? {}
  context[CACHE_KEY] = cache
  return cache
}

/**
 * All incoming headers as a `Headers` instance, extracted once per request.
 * Better Auth reads the session cookie and `x-api-key` from these.
 */
export function getRequestAuthHeaders(event: H3Event): Headers {
  const cache = cacheFor(event)
  cache.headers ??= new Headers(
    Object.fromEntries(
      Object.entries(getHeaders(event)).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(', ') : value ?? '',
      ]),
    ),
  )
  return cache.headers
}

/**
 * Resolve the caller's Better Auth session, memoized for the request.
 * Returns `null` for anonymous callers — callers decide what that means.
 */
export function resolveRequestSession(event: H3Event): Promise<AuthSession> {
  const cache = cacheFor(event)
  cache.session ??= auth.api.getSession({ headers: getRequestAuthHeaders(event) })
  return cache.session
}
