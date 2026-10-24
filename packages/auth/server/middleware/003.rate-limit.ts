import type { H3Event } from 'h3'
import { resolveRequestSession } from '../utils/request-session'

/**
 * API rate limiting.
 *
 * Per-instance, in-memory token windows. That is deliberate: it needs no new
 * infrastructure to stop the realistic abuse cases (LLM spend, video download,
 * upload, export, credential stuffing) and it degrades to "more permissive"
 * rather than "broken" if you run several instances. For a hard global limit
 * across replicas, back `hit()` with Redis — the call sites do not change.
 */

interface RateBucket {
  name: string
  limit: number
  windowMs: number
}

interface Hit {
  count: number
  resetAt: number
}

const MINUTE = 60_000

const AUTH_BUCKET: RateBucket = { name: 'auth', limit: 10, windowMs: MINUTE }
const AI_BUCKET: RateBucket = { name: 'ai', limit: 20, windowMs: MINUTE }
const UPLOAD_BUCKET: RateBucket = { name: 'upload', limit: 10, windowMs: MINUTE }
const DEFAULT_BUCKET: RateBucket = { name: 'default', limit: 120, windowMs: MINUTE }

const MAX_ENTRIES = 20_000
const hits = new Map<string, Hit>()

function bucketFor(path: string, method: string): RateBucket {
  if (/^\/api\/auth\/(sign-in|sign-up|forget-password|reset-password|verify-email)/.test(path)) {
    return AUTH_BUCKET
  }
  if (path.startsWith('/api/v1/agent') || path.startsWith('/api/ai-tools')) return AI_BUCKET
  if (path.startsWith('/api/v1/media') || path.includes('/assets') || path.includes('/documents/upload')) {
    return method === 'POST' || method === 'PUT' ? UPLOAD_BUCKET : DEFAULT_BUCKET
  }
  return DEFAULT_BUCKET
}

function clientAddress(event: H3Event): string {
  // Only a deployment that declares a proxy may use forwarding headers; the
  // middleware in 000.ip-headers strips them otherwise, but we also refuse to
  // read them here so a future middleware reorder cannot reintroduce the bypass.
  if (process.env.NUXT_TRUST_PROXY === '1') {
    const forwarded = getRequestHeader(event, 'x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]!.trim()
    const realIp = getRequestHeader(event, 'x-real-ip')
    if (realIp) return realIp.trim()
  }
  return event.node.req.socket.remoteAddress ?? 'unknown'
}

async function rateLimitKey(event: H3Event, path: string): Promise<string> {
  // Only /api/v1 and /api/ai-tools have a session; resolving one on the auth
  // routes themselves would be circular (and expensive).
  const canResolveSession = path.startsWith('/api/v1') || path.startsWith('/api/ai-tools')
  if (!canResolveSession) return `ip:${clientAddress(event)}`
  // 001.auth / 002.evlog already resolved (and memoized) the session for
  // /api/v1, so this lookup is free for the routes that matter.
  const session = await resolveRequestSession(event).catch(() => null)
  if (session?.user?.id) return `user:${session.user.id}`
  return `ip:${clientAddress(event)}`
}

function hit(key: string, bucket: RateBucket): Hit & { limited: boolean } {
  const now = Date.now()
  const existing = hits.get(key)
  const entry = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + bucket.windowMs }
  entry.count += 1
  hits.set(key, entry)
  if (hits.size > MAX_ENTRIES) evictExpired(now)
  return { ...entry, limited: entry.count > bucket.limit }
}

function evictExpired(now: number): void {
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key)
  }
}

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''
  if (!path.startsWith('/api/')) return

  const method = getMethod(event)
  if (method === 'OPTIONS') return

  const bucket = bucketFor(path, method)
  const key = `${bucket.name}:${await rateLimitKey(event, path)}`
  const result = hit(key, bucket)
  if (!result.limited) return

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  setResponseHeaders(event, {
    'Retry-After': String(retryAfter),
    'X-RateLimit-Limit': String(bucket.limit),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  })
  throw createError({
    statusCode: 429,
    statusMessage: 'Too Many Requests',
    message: `Rate limit exceeded for ${bucket.name} requests. Retry in ${retryAfter}s.`,
  })
})
