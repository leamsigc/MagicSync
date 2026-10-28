import type { H3Event } from 'h3'
import { getQuery, sendRedirect } from 'h3'
import { resolveRequestSession } from '#layers/BaseAuth/server/utils/request-session'

/**
 * OAuth error landing page.
 *
 * Both connect (`linkSocial`) and sign-in (`signIn.social`) pass
 * `errorCallbackURL: '/api/v1/social-accounts/oauth-error'`. Better Auth stores
 * it in the signed OAuth state, so every callback failure redirects here
 * instead of its built-in page — which in production bounces to `/?error=<code>`
 * (a marketing home page with no explanation, and nothing in the server logs).
 *
 * This route is the single seam where a provider/linking failure becomes:
 *   1. a structured log line (the reason the user saw "no error in the logs"),
 *   2. a redirect to the integrations screen with a machine-readable code the
 *      UI turns into a readable toast.
 *
 * Deliberately public (see PUBLIC_API_PATHS in packages/auth/server/middleware):
 * it must work for anonymous sign-in failures too, and it exposes no data —
 * only the code already present in the URL.
 */
const DEFAULT_ERROR_CODE = 'unknown'

/** Error codes land in a URL: keep them to the shape Better Auth emits. */
function normalizeCode(raw: unknown): string {
  const code = typeof raw === 'string' ? raw : ''
  return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : DEFAULT_ERROR_CODE
}

/** Signed-in users return to the integrations screen, everyone else to login. */
async function landingPath(event: H3Event): Promise<string> {
  const session = await resolveRequestSession(event).catch(() => null)
  return session?.user ? '/app/integrations' : '/login'
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const error = normalizeCode(query.error)
  const description = typeof query.error_description === 'string'
    ? query.error_description.slice(0, 500)
    : undefined

  // No token or profile data here: the code plus a short provider description
  // is enough to diagnose a linking/OAuth failure.
  log.warn({
    message: 'OAuth connection failed',
    error,
    errorDescription: description,
  })

  const landing = await landingPath(event)
  return sendRedirect(event, `${landing}?error=${encodeURIComponent(error)}`)
})
