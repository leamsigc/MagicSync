import { test, expect, type Page } from './fixtures'
import {
  createTestUser,
  loginWith,
  waitForHydration,
  type TestUser,
} from './helpers/e2e-utils'

/**
 * Regression tests for the MCP OAuth consent flow bounce:
 * authorize → /consent → /app (consent view never rendered).
 *
 * Real auth stack (Better Auth + local libSQL); only the OAuth-client and
 * business lookups are stubbed. The session endpoint is never mocked.
 */

const CONSENT_QUERY =
  'response_type=code'
  + '&client_id=e2e-test-client'
  + '&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback'
  + '&scope=openid%20profile%20email%20offline_access%20mcp%3Aread'
  + '&state=e2e-state'
  + '&code_challenge=e2e-challenge'
  + '&code_challenge_method=S256'
  + '&prompt=consent'

let user: TestUser

test.beforeAll(async ({ request }) => {
  user = await createTestUser(request)
})

/** Stub the OAuth-client + business lookups the consent page needs to render. */
async function mockConsentContext(page: Page): Promise<void> {
  await page.route('**/api/v1/oauth/client*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'E2E Test Client' }),
    })
  })
  await page.route('**/api/v1/business', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'biz-e2e', name: 'E2E Business' }] }),
      })
    }
    else {
      await route.continue()
    }
  })
}

test.describe('OAuth consent flow (/consent)', () => {
  test('logged-out visitor is sent to login with the consent URL preserved', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/consent?${CONSENT_QUERY}`)
    await waitForHydration(page)

    await expect(page).toHaveURL(/\/login/)
    expect(page.url()).toContain('redirect=')
    expect(decodeURIComponent(page.url())).toContain('/consent?')
  })

  test('logged-in visitor on /login?redirect=<consent> resumes to consent, not /app', async ({ page }) => {
    await mockConsentContext(page)
    await loginWith(page, user)
    const consentPath = `/consent?${CONSENT_QUERY}`
    await page.goto(`/login?redirect=${encodeURIComponent(consentPath)}`)
    await waitForHydration(page)

    // NOTE: match `/consent?` with the literal `?` — a looser `/consent/`
    // pattern also matches the `redirect=/consent%3F…` param of the /login
    // URL and would pass while stuck on the login page.
    // Pre-fix the middleware dropped ?redirect= and landed on /app.
    await expect(page).toHaveURL(/\/consent\?/)
    await expect(page.getByRole('button', { name: 'Allow access' })).toBeVisible({ timeout: 15000 })
  })

  test('logged-in visitor survives a transient get-session failure and reaches consent', async ({ page }) => {
    await mockConsentContext(page)
    await loginWith(page, user)
    let sessionCalls = 0
    await page.route('**/api/auth/get-session', async (route) => {
      sessionCalls += 1
      if (sessionCalls === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'transient failure' }),
        })
      }
      else {
        await route.continue()
      }
    })

    await page.goto(`/consent?${CONSENT_QUERY}`)
    await waitForHydration(page)

    await expect(page).toHaveURL(/\/consent\?/, { timeout: 20000 })
    await expect(page).toHaveURL(/client_id=e2e-test-client/)
    await expect(page.getByRole('button', { name: 'Allow access' })).toBeVisible({ timeout: 15000 })
  })
})
