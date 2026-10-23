import { identifyUser } from 'evlog/better-auth'
import { resolveRequestSession } from '../utils/request-session'

const EXCLUDED_PREFIX = '/api/auth/'

/**
 * Identify the authenticated user on every request wide event (evlog
 * Better Auth recipe). Runs after 001.auth, which already resolved the
 * session — `resolveRequestSession` hands back the same per-request promise,
 * so identification costs no extra database round trip.
 *
 * Safe by default: evlog only extracts whitelisted session fields, never
 * passwords or tokens.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  if (!log) return
  if (event.path?.startsWith(EXCLUDED_PREFIX)) return

  const startedAt = Date.now()
  try {
    const session = await resolveRequestSession(event)
    if (session) {
      identifyUser(log, session)
      log.set({ auth: { resolvedIn: Date.now() - startedAt, identified: true } })
      return
    }
    log.set({ auth: { resolvedIn: Date.now() - startedAt, identified: false } })
  } catch {
    // Enrichment must never fail the request; the auth gate in 001 owns 401s.
    log.set({ auth: { resolvedIn: Date.now() - startedAt, identified: false, error: true } })
  }
})
