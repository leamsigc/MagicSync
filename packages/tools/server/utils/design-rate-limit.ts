/**
 * Tiny in-memory token-bucket rate limiter for design automation routes.
 * Per user, sliding minute window. Good enough for sync batch endpoints;
 * heavier enforcement lives at the gateway layer.
 */

const BUCKETS = new Map<string, { count: number; windowStart: number }>()

export interface RateLimitRule {
  name: string
  limit: number
  windowMs: number
}

export const DESIGN_RATE_RULES = {
  render: { name: 'design.render', limit: 120, windowMs: 60_000 },
  batch: { name: 'design.batch', limit: 10, windowMs: 60_000 },
  mp4: { name: 'design.mp4', limit: 20, windowMs: 60_000 },
  webhook: { name: 'design.webhookTest', limit: 6, windowMs: 60_000 },
} as const

export function designRateLimit(userId: string, rule: RateLimitRule): boolean {
  const key = `${rule.name}:${userId}`
  const now = Date.now()
  const bucket = BUCKETS.get(key)
  if (!bucket || now - bucket.windowStart >= rule.windowMs) {
    BUCKETS.set(key, { count: 1, windowStart: now })
    return true
  }
  if (bucket.count >= rule.limit) return false
  bucket.count += 1
  return true
}

export function rateLimitStatus(userId: string, rule: RateLimitRule): { resetMs: number; remaining: number } {
  const bucket = BUCKETS.get(`${rule.name}:${userId}`)
  if (!bucket) return { resetMs: 0, remaining: rule.limit }
  const elapsed = Date.now() - bucket.windowStart
  return {
    resetMs: Math.max(0, rule.windowMs - elapsed),
    remaining: Math.max(0, rule.limit - bucket.count),
  }
}
