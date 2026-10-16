/**
 * Discover the routes of the running site from Nuxt's own generated manifest.
 *
 * `nuxt-link-checker` (a catalog dependency of `packages/site`) writes
 * `.nuxt/link-checker/routes.json` with every route Nuxt built. Reading it is
 * the source of truth — it knows about routes contributed by all layers
 * (site, auth, content, connect, ui), which a filesystem glob would have to
 * re-derive and would get wrong for aliases and i18n variants.
 *
 * The file only exists after a dev/build run, so a sweep must be pointed at a
 * running instance (the Playwright `webServer` starts one).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROUTES_JSON = fileURLToPath(
  new URL('../../../.nuxt/link-checker/routes.json', import.meta.url),
)

interface RouteManifest {
  staticRoutes?: string[]
  dynamicRoutes?: string[]
}

function readManifest(): RouteManifest {
  try {
    return JSON.parse(readFileSync(ROUTES_JSON, 'utf8')) as RouteManifest
  } catch {
    return {}
  }
}

/** Routes with no parameters — directly visitable, e.g. `/app/posts/new`. */
export function readStaticRoutes(): string[] {
  return [...new Set(readManifest().staticRoutes ?? [])].sort()
}

/** Routes with parameters, e.g. `/app/business/:id()`. Not directly visitable. */
export function readDynamicRoutes(): string[] {
  return [...new Set(readManifest().dynamicRoutes ?? [])].sort()
}

/**
 * Static routes filtered by a path prefix (`SCREENSHOT_ROUTE_PREFIX`) so a
 * sweep can be scoped, e.g. `/tools` captures only the public tools.
 */
export function selectStaticRoutes(prefix?: string): string[] {
  const routes = readStaticRoutes()
  if (!prefix) return routes
  return routes.filter((route) => route === prefix || route.startsWith(`${prefix}/`))
}

/** Absolute path of the manifest, for error messages. */
export function routeManifestPath(): string {
  return ROUTES_JSON
}
