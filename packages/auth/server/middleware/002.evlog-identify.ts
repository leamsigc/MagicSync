import { createAuthMiddleware } from 'evlog/better-auth'
import { auth } from '#layers/BaseAuth/lib/auth'

const identify = createAuthMiddleware(auth, {
  exclude: ['/api/auth/**'],
})

/**
 * Identify the authenticated user on every request wide event (evlog
 * Better Auth recipe). Runs after 001.auth; safe by default — only
 * whitelisted session fields, never passwords or tokens.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  if (!log) return
  await identify(log, event.headers, event.path)
})
