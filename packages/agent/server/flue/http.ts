import type { Agent } from '@flue/runtime'
import { createAgentRouter } from '@flue/runtime/routing'
import { createError, defineEventHandler, type EventHandler, type H3Event, toWebRequest } from 'h3'
import { getFlueRuntime, type FlueProvider } from './runtime'

/**
 * Mounts one Flue agent's conversation surface on the Nitro server
 * (PRD-FLUE-RUNTIME-CONVERGENCE T25): the router from
 * `createAgentRouter(agent)` is served under `basePath`, conversation ids are
 * namespaced per caller, and the runtime boots once through the shared
 * singleton before the first request is delegated.
 */
export interface FlueAgentMountOptions {
  agent: Agent
  /** Nitro route prefix the conversation URL is served under. */
  basePath: string
  /**
   * Provider set for the runtime boot (`buildBusinessProvider(...).provider`, or
   * a hermetic stub); omitted keeps Flue's built-in providers, which resolve
   * credentials from the process environment.
   */
  providers?: readonly FlueProvider[]
  /** Per-request conversation namespace (the authenticated user id). */
  resolveNamespace?: (event: H3Event) => Promise<string | undefined> | string | undefined
}

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Path after the mount prefix, or null when the request is outside it. */
function withinMount(pathname: string, basePath: string): string | null {
  if (pathname === basePath) return '/'
  if (!pathname.startsWith(`${basePath}/`)) return null
  return pathname.slice(basePath.length)
}

/** Router-relative path with the caller namespace prepended to the id segment. */
function namespacedPath(relative: string, namespace?: string): string {
  if (!namespace) return relative
  const [id, ...rest] = relative.split('/').filter(Boolean)
  if (!id) return '/'
  const suffix = rest.length > 0 ? `/${rest.join('/')}` : ''
  return `/${encodeURIComponent(namespace)}.${id}${suffix}`
}

/** Same request (method, headers, body, query) addressed at the router path. */
function atPath(request: Request, path: string): Request {
  const url = new URL(request.url)
  url.pathname = path
  return new Request(url, request)
}

export function createFlueAgentHandler(options: FlueAgentMountOptions): EventHandler {
  const basePath = normalizeBasePath(options.basePath)
  const router = createAgentRouter(options.agent)
  return defineEventHandler(async (event) => {
    const request = toWebRequest(event)
    const relative = withinMount(new URL(request.url).pathname, basePath)
    if (relative === null) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    const namespace = await options.resolveNamespace?.(event)
    await getFlueRuntime({ agents: [options.agent], providers: options.providers })
    return router.fetch(atPath(request, namespacedPath(relative, namespace)))
  })
}
