/**
 * Platform-specific rate limiter using an in-memory sliding window.
 *
 * Each platform has its own window that resets after `windowMs`.
 * No Redis needed — per-instance tracking is acceptable for v1.
 * Multi-instance deployments will have independent rate limiters per instance.
 */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
}

/** Default rate limits per platform (based on official API docs) */
export const PLATFORM_RATE_LIMITS: Record<string, RateLimitConfig> = {
  twitter: { maxRequests: 50, windowMs: 15 * 60 * 1000 },       // 50 per 15min (free tier)
  x: { maxRequests: 50, windowMs: 15 * 60 * 1000 },
  linkedin: { maxRequests: 25, windowMs: 60 * 1000 },         // 25 per minute
  facebook: { maxRequests: 200, windowMs: 60 * 1000 },        // 200 per minute
  instagram: { maxRequests: 20, windowMs: 60 * 60 * 1000 },   // 20 per hour (basic tier)
  'instagram-standalone': { maxRequests: 20, windowMs: 60 * 60 * 1000 },
  threads: { maxRequests: 30, windowMs: 60 * 1000 },
  bluesky: { maxRequests: 300, windowMs: 60 * 60 * 1000 },    // 300 per hour
  youtube: { maxRequests: 10, windowMs: 60 * 1000 },
  tiktok: { maxRequests: 50, windowMs: 60 * 1000 },
  reddit: { maxRequests: 30, windowMs: 60 * 1000 },
  devto: { maxRequests: 30, windowMs: 60 * 1000 },
  dribbble: { maxRequests: 60, windowMs: 60 * 1000 },
  discord: { maxRequests: 50, windowMs: 60 * 1000 },
  googlemybusiness: { maxRequests: 10, windowMs: 60 * 1000 },
  wordpress: { maxRequests: 60, windowMs: 60 * 1000 },
  default: { maxRequests: 30, windowMs: 60 * 1000 }
}

export interface RateLimitResult {
  allowed: boolean
  /** Milliseconds to wait before retry (only when allowed=false) */
  retryAfterMs?: number
  /** Current request count in the window (for monitoring) */
  currentCount?: number
}

/** Internal window state */
interface WindowState {
  count: number
  resetAt: number
}

export class PlatformRateLimiter {
  /** Per-platform sliding windows */
  private windows: Map<string, WindowState> = new Map()

  /**
   * Check if a request can be made to the given platform.
   * If allowed, increments the counter. If not, returns retry delay.
   */
  canMakeRequest(platform: string): RateLimitResult {
    const config = PLATFORM_RATE_LIMITS[platform] ?? PLATFORM_RATE_LIMITS['default']!
    const now = Date.now()
    const entry = this.windows.get(platform)

    // Window expired — reset
    if (!entry || now > entry.resetAt) {
      this.windows.set(platform, { count: 1, resetAt: now + config.windowMs })
      return { allowed: true, currentCount: 1 }
    }

    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        retryAfterMs: entry.resetAt - now,
        currentCount: entry.count
      }
    }

    entry.count++
    return { allowed: true, currentCount: entry.count }
  }

  /**
   * Get the current state of all windows (for monitoring/debugging).
   */
  getState(): Record<string, { count: number; resetAt: number; maxRequests: number }> {
    const result: Record<string, { count: number; resetAt: number; maxRequests: number }> = {}
    for (const [platform, state] of this.windows) {
      const config = PLATFORM_RATE_LIMITS[platform] ?? PLATFORM_RATE_LIMITS['default']!
      result[platform] = { ...state, maxRequests: config.maxRequests }
    }
    return result
  }

  /** For testing: clear all windows */
  reset(): void {
    this.windows.clear()
  }

  /** Check if a specific platform is rate-limited right now */
  isRateLimited(platform: string): boolean {
    return !this.canMakeRequest(platform).allowed
  }
}

/** Singleton instance for use across the scheduler */
export const platformRateLimiter = new PlatformRateLimiter()
