import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Dev-mode SSR compiles routes on demand — one retry absorbs vite races
  retries: process.env.CI ? 2 : 1,
  // The dev server is a single Node process; more than a couple of
  // concurrent browsers causes connection resets (net::ERR_ABORTED).
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    // The site dev script is launched from the repository root so Nuxt gets
    // the shared .env used by the real auth/database stack.
    command: 'pnpm --dir ../.. site:dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
