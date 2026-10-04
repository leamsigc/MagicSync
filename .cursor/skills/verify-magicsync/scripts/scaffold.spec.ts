/**
 * Scaffold for a one-off MagicSync verification drive.
 *
 * 1. Copy this file into the Playwright testDir (the config only picks up
 *    specs under tests/e2e):
 *      cp .cursor/skills/verify-magicsync/scripts/scaffold.spec.ts \
 *         packages/site/tests/e2e/verify-<feature>.spec.ts
 * 2. Replace the FEATURE block below with the recipe from
 *    .cursor/skills/verify-magicsync/features/<feature>.md
 * 3. Run exactly one spec file — note the `exec` form, `pnpm test:e2e -- <file>`
 *    silently runs the whole 413-test suite:
 *      pnpm --filter @local-monorepo/site exec playwright test \
 *        verify-<feature>.spec.ts --reporter=list
 * 4. Tear down with:
 *      .cursor/skills/verify-magicsync/scripts/cleanup.sh
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { createTestUser, loginWith, waitForHydration, type TestUser } from './helpers/e2e-utils'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
// Evidence lives beside the skill and survives cleanup. Never write proof to
// packages/site/test-results/ — Playwright wipes that directory on every run.
const EVIDENCE = '../../.cursor/skills/verify-magicsync/evidence/<feature-slug>'

let authed: APIRequestContext
let user: TestUser

/** Capture a proof screenshot at a numbered step. */
async function proof(page: Page, step: string) {
  mkdirSync(EVIDENCE, { recursive: true })
  await page.screenshot({ path: `${EVIDENCE}/${step}.png`, fullPage: true })
}

/** Capture the accessibility tree — the stable-handle view of the same state. */
async function aria(page: Page, step: string) {
  mkdirSync(EVIDENCE, { recursive: true })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(`${EVIDENCE}/${step}.aria.txt`, await page.locator('body').ariaSnapshot())
}

test('FEATURE: describe the user-visible behaviour being proved', async ({ page, playwright }) => {
  // Dev-mode vite cold-compiles a route on first hit; the very first run of a
  // new route can exceed three minutes. 300s absorbs it without masking hangs.
  test.setTimeout(300000)

  // ---- fixtures -----------------------------------------------------------
  // A real signup, a real session cookie, and a real database row. Nothing is
  // mocked, so every assertion below reflects production behaviour.
  authed = await playwright.request.newContext({ baseURL: BASE })
  user = await createTestUser(authed)
  await loginWith(page, user)

  // Most /app routes need a business or the onboarding middleware bounces the
  // user to /app/business/initial. Seed one through the real API:
  //
  //   const { createActiveBusiness } = await import('./helpers/e2e-utils')
  //   const business = await createActiveBusiness(authed, user)
  //
  // Then scope every subsequent call with `business.id`.

  // Block heavyweight third-party assets some tools fetch on mount. Keep the
  // tools degrading to their idle/error state; it makes runs fast and stable.
  // await blockHeavyAssets(page)

  // ---- FEATURE: replace everything below with the mapped recipe ------------

  await page.goto(`${BASE}/`)
  await waitForHydration(page)
  await expect(page).toHaveTitle()
  await proof(page, '01-initial')

  // Assert the action, not just the landing screen.
  // Assert the side effect through a read-only second view.
})