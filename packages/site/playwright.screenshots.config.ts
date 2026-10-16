import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/**
 * Config for the full-route screenshot sweep and the mobile audit ONLY.
 *
 * The sweep visits every route and is far too slow (and too noisy) to live in
 * the default suite, so it gets its own `testDir` and is never picked up by
 * `pnpm test:e2e`. Same harness, same helpers, same baseURL — only the entry
 * point differs.
 *
 *   pnpm screenshots:routes                          # every static route, desktop
 *   SCREENSHOT_ROUTE_PREFIX=/tools pnpm screenshots:routes
 *
 *   SCREENSHOT_VIEWPORT=mobile pnpm screenshots:mobile
 *   SCREENSHOT_VIEWPORT=mobile SCREENSHOT_ROUTE_PREFIX=/app pnpm screenshots:mobile
 *
 * `SCREENSHOT_VIEWPORT=mobile` switches to an iPhone-class viewport **and**
 * redirects output to `packages/doc/public/img/screenshots-mobile/`, so a mobile
 * pass can never overwrite a desktop image. See
 * `packages/doc/skills/capture-all-routes-screenshots/SKILL.md`.
 */
const VIEWPORT = process.env.SCREENSHOT_VIEWPORT === 'mobile' ? 'mobile' : 'desktop'

/**
 * Set before Playwright loads the test files: `route-screenshots.ts` reads
 * `SCREENSHOT_ROOT` at module scope, so a mobile run needs this assigned here
 * rather than inside a spec.
 */
if (VIEWPORT === 'mobile' && !process.env.SCREENSHOT_ROOT) {
  process.env.SCREENSHOT_ROOT = fileURLToPath(
    new URL('../doc/public/img/screenshots-mobile/', import.meta.url),
  )
}

export default defineConfig({
  testDir: './tests/screenshots',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One browser, one dev server. Concurrent browsers cause net::ERR_ABORTED
  // connection resets against the single Nuxt dev process.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000',
    // 390x844 is an iPhone 14/15 class viewport — the narrowest width the app
    // claims to support.
    viewport: VIEWPORT === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: VIEWPORT === 'mobile',
    hasTouch: VIEWPORT === 'mobile',
    // 1x on purpose: a 2x phone screenshot is 4x the bytes for no extra layout
    // information, and this suite puts ~150 images in the repo.
    deviceScaleFactor: 1,
    launchOptions: { args: ['--disable-dev-shm-usage'] },
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'pnpm --dir ../.. site:dev',
    url: process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
