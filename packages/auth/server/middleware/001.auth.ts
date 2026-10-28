import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

/**
 * The single authentication gate for the API surface.
 *
 * Deny-by-default: everything under `/api` requires a session unless it is
 * explicitly listed here. The previous version only covered `/api/v1`, so the
 * `/api/ai-tools/**` and `/api/a2ui/**` namespaces were protected only by the
 * `authenticate()` call inside each handler — one forgotten line away from an
 * unauthenticated endpoint.
 */

/** Public by product design (shareable pages, podcast proxy, auth endpoints). */
const PUBLIC_API_PATHS = [
  '/api/auth',
  // nuxt-auth-utils' own session probe (`GET`/`DELETE /api/_auth/session`).
  // It returns `{}`/204 for anonymous callers; gating it turned every logged-out
  // page load into a 401 logged at error level with a stack.
  '/api/_auth',
  '/api/v1/assets/public',
  '/api/v1/podcast/search',
  '/api/v1/podcast/feed',
  '/api/v1/podcast/audio',
  '/api/v1/menu-board/public',
  '/api/v1/carousel/public',
  // OAuth failure landing (see packages/connect/server/api/v1/social-accounts/
  // oauth-error.get.ts). Better Auth redirects here with `?error=<code>`; it
  // reads only that code and redirects onward, so anonymous sign-in failures
  // must reach it too.
  '/api/v1/social-accounts/oauth-error',
]

/** Uses its own `x-api-key` verification middleware. */
const API_KEY_PREFIX = '/api/v1/cli'

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || (prefix.endsWith('/') && path.startsWith(prefix))
}

function isPublicApiPath(path: string): boolean {
  // Nitro-internal handlers only. A blanket `/api/_` would silently expose any
  // future internal route (Nitro's task trigger, devtools bridges, …).
  if (path.startsWith('/api/_nuxt_') || path.startsWith('/api/_content')) return true
  return PUBLIC_API_PATHS.some(prefix => matchesPrefix(path, prefix))
}

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''
  if (!path.startsWith('/api/')) return
  if (isPublicApiPath(path)) return
  if (matchesPrefix(path, API_KEY_PREFIX)) return

  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  // SAFE: only log user.id — never email, role, image URL, or the full user object.
  log.info({ content: 'User authenticated', userId: user.id })

  if (user.role !== 'admin' && matchesPrefix(path, '/api/v1/admin')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin access required.'
    })
  }
})
