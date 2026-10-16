import { defineConfig } from '@playwright/test'

/**
 * Config for the full-route screenshot sweep ONLY.
 *
 * The sweep visits every route and is far too slow (and too noisy) to live in
 * the default suite, so it gets its own `testDir` and is never picked up by
 * `pnpm test:e2e`. Same harness, same helpers, same baseURL — only the entry
 * point differs.
 *
 *   pnpm screenshots:routes                          # every static route
 *   SCREENSHOT_ROUTE_PREFIX=/tools pnpm screenshots:routes
 *
 * See `packages/doc/skills/capture-all-routes-screenshots/SKILL.md`.
 */
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
    viewport: { width: 1440, height: 900 },
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
