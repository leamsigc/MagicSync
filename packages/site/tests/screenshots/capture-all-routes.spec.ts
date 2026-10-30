/**
 * Capture every static route of the running site.
 *
 * One folder per route, one `page.png` per route (the landing state). Working on
 * a specific action later adds more files to that route's folder — see
 * `packages/doc/skills/route-action-screenshots/SKILL.md`.
 *
 * Re-running replaces each route's `page.png`. Nothing accumulates.
 *
 *   pnpm screenshots:routes
 *   SCREENSHOT_ROUTE_PREFIX=/app/bulk-scheduler pnpm screenshots:routes
 *   SCREENSHOT_ROUTE_TIMEOUT=90000 pnpm screenshots:routes
 *
 * Cold-route compile: the first hit on a never-visited route can take minutes
 * in dev. Run the sweep twice — the first pass warms the routes, the second
 * captures them cleanly. Per-route failures are recorded, not fatal.
 */
import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createActiveBusiness, createTestUser, loginWith, promoteToAdmin } from '../e2e/helpers/e2e-utils'
import { captureRouteAction, SCREENSHOT_ROOT, slugifyRoute } from '../e2e/helpers/route-screenshots'
import { routeManifestPath, selectStaticRoutes } from '../e2e/helpers/route-list'

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'
const ROUTE_TIMEOUT = Number(process.env.SCREENSHOT_ROUTE_TIMEOUT ?? 45000)
const ACTION = 'page'

interface RouteEntry {
  route: string
  slug: string
  action: string
  file: string | null
  finalUrl: string
  status: number | null
  ok: boolean
  error?: string
}

async function visitRoute(page: Page, route: string): Promise<RouteEntry> {
  const slug = slugifyRoute(route)
  try {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: ROUTE_TIMEOUT })
    const shot = await captureRouteAction(page, { route, action: ACTION })
    return {
      route,
      slug,
      action: ACTION,
      file: shot.relativePath,
      finalUrl: page.url(),
      status: response?.status() ?? null,
      ok: true,
    }
  } catch (error) {
    return {
      route,
      slug,
      action: ACTION,
      file: null,
      finalUrl: page.url(),
      status: null,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function writeManifest(entries: RouteEntry[]): string {
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    action: ACTION,
    total: entries.length,
    captured: entries.filter((entry) => entry.ok).length,
    entries,
  }
  const mobile = process.env.SCREENSHOT_VIEWPORT === 'mobile'
  const fileName = mobile ? 'manifest-mobile.json' : 'manifest.json'
  const file = join(SCREENSHOT_ROOT, fileName)
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  return file
}

test('capture every static route', async ({ page, playwright }) => {
  // A full sweep legitimately runs for many minutes — the work is the timeout.
  test.setTimeout(0)

  const prefix = process.env.SCREENSHOT_ROUTE_PREFIX
  const routes = selectStaticRoutes(prefix)
  if (routes.length === 0) {
    throw new Error(
      `No routes found in ${routeManifestPath()}. ` +
        'Start the dev server once (nuxt-link-checker writes the manifest), ' +
        'and check SCREENSHOT_ROUTE_PREFIX if you set one.',
    )
  }

  // Real, unmocked auth so /app/* renders its authenticated state instead of
  // bouncing to /login. Most /app routes also need an active business.
  const authed = await playwright.request.newContext({ baseURL: BASE_URL })
  const user = await createTestUser(authed)
  // `/app/admin/*` redirects non-admins to the dashboard, which would capture the
  // wrong page as evidence. Promote before the first login so every admin route
  // renders its real state.
  await promoteToAdmin(authed, user)
  await loginWith(page, user)
  await createActiveBusiness(authed, user)

  const entries: RouteEntry[] = []
  for (const route of routes) {
    const entry = await visitRoute(page, route)
    entries.push(entry)
    // Progress on one line per route — the sweep is long and silent otherwise.
    process.stdout.write(`${entry.ok ? 'ok  ' : 'FAIL'} ${route} -> ${entry.finalUrl}\n`)
  }

  const manifest = writeManifest(entries)
  const failed = entries.filter((entry) => !entry.ok)
  expect(failed.length, `${failed.length}/${entries.length} routes failed`).toBeLessThan(entries.length)
  process.stdout.write(`\ncaptured ${entries.length - failed.length}/${entries.length} routes -> ${manifest}\n`)
})
