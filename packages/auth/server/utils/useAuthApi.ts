/**
 * useAuthApi — wraps better-auth's `auth.api` with automatic header injection.
 *
 * Usage:
 *   const authApi = useAuthApi(event)
 *   await authApi.getSession()
 *   await authApi.getFullOrganization({ query: { organizationId } })
 *   await authApi.createApiKey({ body: { name, organizationId } })
 *
 * How it works:
 *   - better-auth's server API reads headers to extract:
 *     (a) session cookie — for cookie/session-based auth
 *     (b) x-api-key header — for API-key-based auth
 *   - We extract ALL headers from H3Event once and reuse them.
 *   - This eliminates the need to prop-drill `Headers` or `header` params
 *     through every service and handler.
 *
 * Two auth modes are supported simultaneously:
 *   - Session (browser/app): cookies auto-read from event.headers
 *   - API key (external): x-api-key header auto-read from event.headers
 */
import { type H3Event, getHeaders } from 'h3'
import { auth } from '#layers/BaseAuth/lib/auth'

export function useAuthApi(event: H3Event) {
  // Extract ALL headers from the incoming request once.
  // Use H3's getHeaders() to reliably read all headers — handles both
  // plain-object and special-proxy event.headers representations.
  // This includes:
  //   - cookie (session auth)
  //   - x-api-key (API key auth)
  //   - authorization, content-type, etc.
  // Headers are lazily cached per-event to avoid repeated extraction.
  let _headers: Headers | null = null

  const headers = (): Headers => {
    if (!_headers) {
      // getHeaders() returns Record<string, string | string[] | undefined>
      // Wrap it in a proper Headers instance so auth.api methods accept it.
      const raw = getHeaders(event)
      _headers = new Headers(
        Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? ''])
        )
      )
    }
    return _headers
  }

  return {
    headers,

    // --- Session ---
    getSession: async () => {
      return await auth.api.getSession({ headers: headers() })
    },

    // --- Organization ---
    getFullOrganization(params: { query?: { organizationId: string } }) {
      return auth.api.getFullOrganization({
        ...params,
        headers: headers()
      })
    },

    createOrganization(params: { body: { name: string; slug?: string; metadata?: Record<string, unknown> } }) {
      return auth.api.createOrganization({
        ...params,
        headers: headers()
      })
    },

    // --- API Keys ---
    verifyApiKey(params: { body: { key: string } }) {
      // verifyApiKey reads the key from body, not headers — pass through
      return auth.api.verifyApiKey(params)
    },

    createApiKey(params: { body: { name: string; organizationId: string; expiresIn?: number; metadata?: Record<string, unknown> } }) {
      return auth.api.createApiKey({
        ...params,
        headers: headers()
      })
    },

    listApiKeys(params: { query?: { organizationId: string } }) {
      return auth.api.listApiKeys({
        ...params,
        headers: headers()
      })
    },

    deleteApiKey(params: { body: { keyId: string } }) {
      return auth.api.deleteApiKey({
        ...params,
        headers: headers()
      })
    },

    // --- Social Accounts ---
    signInSocial(params: { body: { provider: string; callbackURL?: string } }) {
      return auth.api.signInSocial(params)
    },

    linkSocialAccount(params: { body: { provider: string; callbackURL?: string } }) {
      return auth.api.linkSocialAccount({
        ...params,
        headers: headers()
      })
    },

    accountInfo(params: { body: { accountId: string } }) {
      return auth.api.accountInfo({
        ...params,
        headers: headers()
      })
    },

    getAccessToken(params: { body: { providerId: string; accountId?: string; userId?: string } }) {
      return auth.api.getAccessToken({
        ...params,
        headers: headers()
      })
    },
  }
}

export type AuthApi = ReturnType<typeof useAuthApi>
