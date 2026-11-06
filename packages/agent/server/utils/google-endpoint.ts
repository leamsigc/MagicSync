/**
 * Google's native Generative Language API base.
 *
 * Gemini must go through pi's native `google-generative-ai` adapter: the
 * OpenAI-compatible surface (`…/v1beta/openai`) drops the `thought_signature`
 * of every tool call, and Gemini 3 rejects the next turn with an opaque 400.
 */
export const GOOGLE_NATIVE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/** True when the URL points at Google's Generative Language host. */
export function isGoogleEndpoint(baseUrl: string | null | undefined): boolean {
  const value = baseUrl?.trim() ?? ''
  if (value === '') return false
  try {
    return new URL(value).hostname === 'generativelanguage.googleapis.com'
  }
  catch {
    return false
  }
}

/**
 * Custom gateways pass through unchanged; a Google host is pinned to the native
 * base so a stale `…/v1beta/openai` override cannot reach the native adapter.
 */
export function normalizeGoogleBaseUrl(baseUrl: string): string {
  return isGoogleEndpoint(baseUrl) ? GOOGLE_NATIVE_BASE_URL : baseUrl
}
