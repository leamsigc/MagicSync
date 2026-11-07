import { getHeaders } from 'h3'
import type { H3Event } from 'h3'
import type { AgentToolContext } from '../tool-context'
import { toolFailure } from './tool-result'

/**
 * The agent layer cannot import site-owned route modules (feature layers stay
 * library-only and the workspace graph would cycle), so chat tools that need a
 * site feature call the app's own HTTP API with the chat request's cookies.
 * Same pattern as `autoreply.tools.ts`.
 */
export function appBaseUrl(): string {
  const url = process.env.NUXT_APP_URL || process.env.NUXT_BETTER_AUTH_URL || 'http://localhost:3000'
  return url.replace(/\/$/, '')
}

/** Headers that describe the original body/connection, not the new request. */
const DROPPED_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'accept-encoding'])

/**
 * Forward the chat request's identity (cookies) without its body framing.
 * Copying `content-length` sends a length that no longer matches the new body,
 * so the internal POST is rejected before the route runs.
 */
function forwardHeaders(event: H3Event): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value === undefined || DROPPED_HEADERS.has(key.toLowerCase())) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }
  return headers
}

interface AppApiOptions {
  method?: 'GET' | 'POST'
  body?: unknown
}

export async function appApi<T>(ctx: AgentToolContext, path: string, options: AppApiOptions = {}): Promise<T> {
  const event = ctx.event
  if (!event) toolFailure('UNAVAILABLE', 'This tool is only available during a signed-in chat request', 'APP_API_ERROR')
  try {
    return await $fetch<T>(`${appBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      body: options.body,
      headers: forwardHeaders(event),
    })
  }
  catch (error) {
    const data = (error as { data?: { statusMessage?: string, message?: string } }).data
    toolFailure('API_ERROR', data?.statusMessage || data?.message || 'The app API request failed', 'APP_API_ERROR')
  }
}
