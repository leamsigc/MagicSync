/**
 * Mobile layout audit.
 *
 * Walks every static route at a phone viewport and records the ones whose
 * content is **wider than the screen** — the failure that makes a page unusable
 * on a phone (a modal off-screen, a table that never scrolls, a fixed-width
 * panel). Horizontal overflow is the honest signal: it needs no screenshot
 * reading and it is what "broken on mobile" almost always means.
 *
 *   SCREENSHOT_VIEWPORT=mobile pnpm screenshots:audit
 *   SCREENSHOT_ROUTE_PREFIX=/app pnpm screenshots:audit
 *   SCREENSHOT_AUDIT_STRICT=1 pnpm screenshots:audit      # fail on any overflow
 *
 * Output: `<SCREENSHOT_ROOT>/mobile-audit.json`, and one line per offending
 * route on stdout. See `packages/doc/skills/audit-mobile-layout/SKILL.md`.
 */
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createActiveBusiness, createTestUser, loginWith } from '../e2e/helpers/e2e-utils'
import { SCREENSHOT_ROOT } from '../e2e/helpers/route-screenshots'
import { selectStaticRoutes } from '../e2e/helpers/route-list'

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'
const ROUTE_TIMEOUT = Number(process.env.SCREENSHOT_ROUTE_TIMEOUT ?? 45000)

export interface OverflowOffender {
  element: string
  width: number
  left: number
  right: number
  clipped: boolean
}

export interface MobileFinding {
  route: string
  finalUrl: string
  viewportWidth: number
  scrollWidth: number
  overflow: number
  offenders: OverflowOffender[]
  /** Set when the page could not be measured at all — never silently "ok". */
  error?: string
}

interface AuditResult {
  viewportWidth: number
  scrollWidth: number
  offenders: OverflowOffender[]
}

/** Names an element the way a developer can find it again. Browser-side. */
/**
 * Everything the audit measures, in one pass over the page.
 *
 * Two distinct failures are reported:
 *
 * - **document overflow** — the page itself is wider than the screen, so the
 *   whole layout scrolls sideways.
 * - **clipped content** — an element's box extends past the right (or left)
 *   edge even though the page does not scroll, i.e. `overflow: hidden` is
 *   hiding it. This is what a fixed-width modal looks like on a phone, and it
 *   never shows up as document overflow.
 *
 * A child of a horizontally scrollable container (`overflow-x: auto/scroll`
 * that actually scrolls) is reachable by swiping, so it is not a bug — that is
 * how wide tables are meant to behave.
 *
 * Everything below runs in the page: a helper defined in this module would not
 * exist in the browser context, and the error would be swallowed as "no
 * findings" — which is exactly how a silently-broken audit reads as a pass.
 */
async function measure(page: Page): Promise<AuditResult> {
  return page.evaluate(() => {
    function label(el: Element): string {
      const testId = el.getAttribute('data-testid')
      const id = testId ? `[data-testid="${testId}"]` : (el.id ? `#${el.id}` : '')
      const role = el.getAttribute('role')
      const rolePart = role ? `[role="${role}"]` : ''
      const classes = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''
      return `${el.tagName.toLowerCase()}${id}${rolePart}${classes ? `.${classes}` : ''}`
    }

    /** Dev-only overlays (Nuxt DevTools, the Vue tracer) are not product UI. */
    function isDevOverlay(el: Element): boolean {
      const tag = el.tagName.toLowerCase()
      return tag.includes('devtools') || tag === 'vue-tracer-overlay' || el.closest('#vue-tracer-overlay, nuxt-devtools-frame') !== null
    }

    /**
     * A decorative flourish (an absolutely-positioned gradient blob parked
     * outside its `overflow-hidden` frame) is meant to be out of frame. Anything
     * with text or a control is not: that is content the user cannot reach.
     */
    function isDecoration(el: Element): boolean {
      const position = getComputedStyle(el).position
      if (position !== 'absolute' && position !== 'fixed') return false
      if ((el.textContent ?? '').trim().length > 0) return false
      return el.querySelector('button, a, input, select, textarea, img, svg') === null
    }

    function scrollableAncestor(el: Element): boolean {
      let parent = el.parentElement
      while (parent) {
        const style = getComputedStyle(parent)
        const scrollsX = style.overflowX === 'auto' || style.overflowX === 'scroll'
        if (scrollsX && parent.scrollWidth > parent.clientWidth + 1) return true
        parent = parent.parentElement
      }
      return false
    }

    const viewportWidth = document.documentElement.clientWidth
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)
    const offenders: Array<{ element: string; width: number; left: number; right: number; clipped: boolean }> = []
    const seen: Element[] = []

    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const rect = el.getBoundingClientRect()
      // Under 8px tall is a progress bar, divider or border — it cannot be
      // "content the user cannot reach", and Nuxt UI's loading indicators sit
      // mid-transform with a bounding box that reads as off-screen.
      if (rect.width < 1 || rect.height < 8) continue
      const pastRight = rect.right > viewportWidth + 1
      const pastLeft = rect.left < -1
      if (!pastRight && !pastLeft) continue
      if (isDevOverlay(el)) continue
      if (isDecoration(el)) continue
      if (seen.some((outer) => outer.contains(el))) continue
      if (scrollableAncestor(el)) continue
      seen.push(el)
      offenders.push({
        element: label(el),
        width: Math.round(rect.width),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        clipped: rect.width > viewportWidth + 1,
      })
    }

    offenders.sort((a, b) => b.width - a.width)
    return { viewportWidth, scrollWidth, offenders: offenders.slice(0, 10) }
  })
}

async function auditRoute(page: Page, route: string): Promise<MobileFinding | null> {
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: ROUTE_TIMEOUT })
  }
  catch {
    // A single aborted navigation (heavy tool pages, dev-server resets) must not
    // end the sweep — the same contract as the route screenshot capture.
    return null
  }
  await page.waitForTimeout(Number(process.env.SCREENSHOT_AUDIT_SETTLE ?? 700))
  const finalUrl = page.url()
  let result: AuditResult
  try {
    result = await measure(page)
  }
  catch (error) {
    // A measurement that throws must be visible, not swallowed: a broken audit
    // that reports "ok" everywhere is worse than no audit.
    return {
      route,
      finalUrl,
      viewportWidth: 0,
      scrollWidth: 0,
      overflow: 0,
      offenders: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
  const hasOverflow = result.scrollWidth > result.viewportWidth + 1
  if (!hasOverflow && result.offenders.length === 0) return null
  return {
    route,
    finalUrl,
    viewportWidth: result.viewportWidth,
    scrollWidth: result.scrollWidth,
    overflow: result.scrollWidth - result.viewportWidth,
    offenders: result.offenders,
  }
}

test('audit every static route at a phone viewport', async ({ page, playwright }) => {
  test.setTimeout(0)

  const prefix = process.env.SCREENSHOT_ROUTE_PREFIX
  const routes = selectStaticRoutes(prefix)
  if (routes.length === 0) {
    throw new Error(`No routes found — start the dev server once so nuxt-link-checker writes its manifest.`)
  }

  const authed = await playwright.request.newContext({ baseURL: BASE_URL })
  const user = await createTestUser(authed)
  await loginWith(page, user)
  await createActiveBusiness(authed, user)

  const findings: MobileFinding[] = []
  for (const route of routes) {
    const finding = await auditRoute(page, route)
    if (finding) findings.push(finding)
    process.stdout.write(
      finding
        ? `BROKEN  +${finding.overflow}px overflow, ${finding.offenders.length} clipped${finding.error ? `, ERROR ${finding.error}` : ''}  ${route}\n`
        : `ok      ${route}\n`,
    )
  }

  const file = join(SCREENSHOT_ROOT, 'mobile-audit.json')
  mkdirSync(SCREENSHOT_ROOT, { recursive: true })
  writeFileSync(file, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: { width: 390, height: 844 },
    checked: routes.length,
    withOverflow: findings.length,
    findings,
  }, null, 2)}\n`)

  process.stdout.write(`\n${findings.length}/${routes.length} routes break on mobile -> ${file}\n`)
  if (findings.length > 0) {
    for (const finding of findings.slice(0, 10)) {
      process.stdout.write(`\n${finding.route} (+${finding.overflow}px)\n`)
      for (const offender of finding.offenders.slice(0, 4)) {
        process.stdout.write(`   ${offender.width}px  ${offender.element}\n`)
      }
    }
  }

  if (process.env.SCREENSHOT_AUDIT_STRICT === '1') {
    expect(findings.map(finding => finding.route), 'routes with horizontal overflow').toEqual([])
  }
})
