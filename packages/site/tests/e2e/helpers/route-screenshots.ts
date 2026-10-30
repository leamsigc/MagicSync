/**
 * Route/action screenshot collection for MagicSync.
 *
 * Layout — one folder per route, one file per action:
 *
 *   packages/doc/public/img/screenshots/<route-slug>/<action>.png
 *
 * Re-capturing an action REPLACES the previous shot for that action (any
 * leading `NN-` step number is ignored when matching), so a route folder holds
 * exactly one canonical image per action and never accumulates `-2` copies.
 *
 * Paths are resolved from this file's own URL, so a caller may import it from
 * any testDir or cwd. Override the output root with `SCREENSHOT_ROOT`.
 *
 * See `packages/doc/skills/route-action-screenshots/SKILL.md`.
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

/** Default output root: `packages/doc/public/img/screenshots` (VitePress-servable). */
export const SCREENSHOT_ROOT = process.env.SCREENSHOT_ROOT
  ? resolve(process.env.SCREENSHOT_ROOT)
  : fileURLToPath(new URL('../../../../doc/public/img/screenshots/', import.meta.url))

/** `/app/posts/new?x=1` -> `app-posts-new`; `/` -> `root`. */
export function slugifyRoute(route: string): string {
  const path = route.split('?')[0]!.split('#')[0]!
  const slug = path
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || 'root'
}

/** `01-Created Post!` -> `created-post`. */
export function slugifyAction(action: string): string {
  const slug = action
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || 'action'
}

/** Identity of an action, ignoring a leading step number: `02-save-post` -> `save-post`. */
function actionKey(name: string): string {
  return name
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .replace(/^\d+-/, '')
    .toLowerCase()
}

/** Absolute directory holding every screenshot for a route. */
export function routeScreenshotDir(route: string): string {
  return join(SCREENSHOT_ROOT, slugifyRoute(route))
}

/**
 * Delete every stored shot for one action on one route, ignoring step numbers.
 * Returns the number of files removed (0 when nothing matched).
 */
export function removeActionScreenshots(route: string, action: string): number {
  const dir = routeScreenshotDir(route)
  if (!existsSync(dir)) return 0
  const key = actionKey(slugifyAction(action))
  const stale = readdirSync(dir).filter((file) => actionKey(file) === key)
  for (const file of stale) rmSync(join(dir, file), { force: true })
  return stale.length
}

/** Dev-only overlays that must never appear in a captured image. */
const DEV_OVERLAY_CSS =
  '#vue-tracer-overlay,nuxt-devtools-frame,nuxt-devtools-inspect-panel,#__nuxt-devtools__,nuxt-devtools-timing,nuxt-devtools-frame-timing,nuxt-error-overlay{display:none!important}'

/**
 * Remove Nuxt DevTools overlays before capture.
 *
 * CSS alone is not enough: the timing pill lives in a **shadow root**, so a
 * page stylesheet cannot reach it. Removing the host element takes its shadow
 * content with it. None of these elements exist in production.
 */
export async function suppressDevOverlays(page: Page): Promise<void> {
  await page.addStyleTag({ content: DEV_OVERLAY_CSS }).catch(() => {})
  await page
    .evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        const tag = el.tagName.toLowerCase()
        if (tag.includes('devtools') || tag === 'vue-tracer-overlay' || tag === 'nuxt-error-overlay') el.remove()
      }
    })
    .catch(() => {})
}

export interface CaptureRouteActionOptions {
  /** Route as a user sees it, e.g. `/app/posts/new`. For dynamic routes pass the
   *  stable pattern (`/app/business/:id/content`), not a concrete id, so the
   *  folder name does not change every run. */
  route: string
  /** What happened, e.g. `post-created`. Becomes the filename. */
  action: string
  /** 1-based position in a journey. Renders as the `NN-` prefix. */
  order?: number
  /** Capture the whole scrollable page (default true). */
  fullPage?: boolean
  /** Extra settle time in ms before the shot (default 250). */
  settleMs?: number
}

export interface CaptureResult {
  /** Absolute path of the written file. */
  file: string
  /** Path relative to `SCREENSHOT_ROOT`, e.g. `app-posts-new/post-created.png`. */
  relativePath: string
  /** Step-numbered files removed because they belonged to the same action. */
  replaced: number
}

/**
 * Capture one action on one route into its route folder, replacing any previous
 * shot of that same action. Waits for network idle (best effort) and hydration
 * settle so the image reflects the settled state, not a loading skeleton.
 */
export async function captureRouteAction(
  page: Page,
  options: CaptureRouteActionOptions,
): Promise<CaptureResult> {
  // Desktop captures the whole page. Mobile captures the viewport: what fits on
  // a phone *is* the mobile layout, and a full-page 1x phone shot is several
  // hundred KB against ~150 files.
  const mobile = process.env.SCREENSHOT_VIEWPORT === 'mobile'
  const { route, action, order, fullPage = !mobile, settleMs = 250 } = options
  const dir = routeScreenshotDir(route)
  mkdirSync(dir, { recursive: true })
  const replaced = removeActionScreenshots(route, action)

  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await suppressDevOverlays(page)
  if (settleMs > 0) await page.waitForTimeout(settleMs)

  const base = slugifyAction(action)
  const name = order === undefined ? base : `${String(order).padStart(2, '0')}-${base}`
  const suffix = mobile ? '-mobile' : ''
  const file = join(dir, `${name}${suffix}.png`)
  await page.screenshot({ path: file, fullPage, animations: 'disabled' })
  return { file, relativePath: relative(SCREENSHOT_ROOT, file), replaced }
}

export interface JourneyOptions {
  /** Route the steps belong to — the folder every step is written into. */
  route: string
  /** First step number (default 1). */
  startAt?: number
}

export interface Journey {
  /** Paths captured so far, in order. */
  readonly captured: string[]
  /** Capture one ordered step. Pass `run` to drive the interaction first. */
  step(action: string, run?: () => Promise<void> | void): Promise<CaptureResult>
}

/**
 * An ordered, re-runnable walkthrough of one route's interactions.
 *
 * Each `step(action, run)` drives the interaction (if given), then captures the
 * resulting state as `NN-<action>.png`. Because replacement ignores the `NN-`
 * prefix, re-running the journey overwrites each step in place — the folder
 * always holds one image per step, never a history.
 *
 * Name steps after the feature map's sub-feature IDs
 * (`.cursor/skills/verify-magicsync/features/`) so the images line up with the
 * documented interaction inventory.
 */
export function journey(page: Page, options: JourneyOptions): Journey {
  let order = options.startAt ?? 1
  const captured: string[] = []
  return {
    get captured() {
      return captured
    },
    async step(action, run) {
      if (run) await run()
      const result = await captureRouteAction(page, { route: options.route, action, order: order++ })
      captured.push(result.relativePath)
      return result
    },
  }
}
