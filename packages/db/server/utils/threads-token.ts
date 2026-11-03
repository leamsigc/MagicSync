const THREADS_GRAPH = 'https://graph.threads.net'

export const THREADS_LONG_LIVED_TTL_MS = 60 * 24 * 60 * 60 * 1000

export interface ThreadsToken {
  accessToken: string
  expiresAt: Date
}

interface ThreadsTokenResponse {
  access_token?: string
  expires_in?: number
}

function tokenExpiry(expiresIn?: number): Date {
  const lifetimeMs = expiresIn && expiresIn > 0 ? expiresIn * 1000 : THREADS_LONG_LIVED_TTL_MS
  return new Date(Date.now() + lifetimeMs)
}

async function requestThreadsToken(path: string, params: Record<string, string>): Promise<ThreadsToken | null> {
  try {
    const query = new URLSearchParams(params).toString()
    const response = await $fetch<ThreadsTokenResponse>(`${THREADS_GRAPH}${path}?${query}`, {
      ignoreResponseError: true,
    })
    if (!response?.access_token) return null
    return { accessToken: response.access_token, expiresAt: tokenExpiry(response.expires_in) }
  } catch {
    return null
  }
}

export async function exchangeThreadsLongLivedToken(
  shortLivedToken: string,
  clientSecret: string
): Promise<ThreadsToken | null> {
  return requestThreadsToken('/access_token', {
    grant_type: 'th_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedToken,
  })
}

export async function refreshThreadsLongLivedToken(longLivedToken: string): Promise<ThreadsToken | null> {
  return requestThreadsToken('/refresh_access_token', {
    grant_type: 'th_refresh_token',
    access_token: longLivedToken,
  })
}
