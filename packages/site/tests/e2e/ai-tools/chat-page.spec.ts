import { test, expect, type Page } from '@playwright/test'
import {
  createTestUser,
  createActiveBusiness,
  loginWith,
  blockHeavyAssets,
  waitForHydration,
  type TestUser,
} from '../helpers/e2e-utils'

/**
 * The chat page is server-rendered through `01.auth.global.ts`, which resolves
 * the session on the server. A browser-level `get-session` mock can never reach
 * that path, so these tests authenticate for real (same seam as
 * `chat-messaging.spec.ts`) and only stub the business-scoped payloads.
 */

async function mockSingleBusiness(page: Page) {
  await page.route('**/api/v1/business', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'biz-1', name: 'Test Bakery' }] }),
    })
  })
  await page.route('**/api/ai-tools/chat/threads', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('**/api/v1/artifacts?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  })
  await page.route('**/api/v1/content-items?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
  })
  await page.route('**/api/v1/social-accounts?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
}

async function mockCapabilities(page: Page) {
  await page.route('**/api/v1/agent/capabilities?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agents: [
          { name: 'orchestrator', description: 'Chat orchestrator.', tools: ['web_search', 'write_post'] },
          { name: 'writer', description: 'Writes drafts.', tools: ['write_post'] },
        ],
        tools: [
          { name: 'web_search', group: 'research', description: 'Search the web.' },
          { name: 'write_post', group: 'content', description: 'Draft a post.' },
        ],
        skills: {
          bundled: [{ slug: 'content-writer', name: 'content-writer', description: 'Write posts.', scope: 'global' }],
          registered: [{ id: 'skill-1', slug: 'brand-voice', name: 'Brand voice', description: 'Our voice.', version: 1, status: 'active', scope: 'business' }],
        },
      }),
    })
  })
}

let user: TestUser

test.beforeAll(async ({ request }) => {
  test.setTimeout(120000)
  user = await createTestUser(request)
  await createActiveBusiness(request, user)
})

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await mockSingleBusiness(page)
    await page.goto('/app/chat')
    await waitForHydration(page)
  })

  test('should display the operator home and safe mode', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Your marketing command center' })).toBeVisible()
    await expect(page.getByText('Human approval required')).toBeVisible()
    await expect(page.getByText('What should we work on?')).toBeVisible()
  })

  test('should expose orchestration starters', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Morning brief' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Find calendar gaps' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create next ideas' })).toBeVisible()
  })

  test('should show the clean composer and keep advanced controls behind actions', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add file' })).toBeVisible()
    await expect(page.getByTestId('chat-options-toggle')).toBeVisible()
    await expect(page.getByPlaceholder('Tell me what you need...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Goals' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Tools' })).not.toBeVisible()
  })

  test('should open activity in a slideover from the header', async ({ page }) => {
    await page.getByRole('button', { name: 'Activity' }).click()
    await expect(page.getByText('Live work and recent runs')).toBeVisible()
    await expect(page.getByText('Recent agent runs')).toBeVisible()
  })

  test('should prompt to add a business when none exists', async ({ page }) => {
    await page.unroute('**/api/v1/business')
    await page.route('**/api/v1/business', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    })
    await page.goto('/app/chat')
    await waitForHydration(page)
    await expect(page.getByRole('heading', { name: 'First, add your business' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add my business' })).toBeVisible()
  })

  test('should show the options button with the default selection summary', async ({ page }) => {
    await expect(page.getByTestId('chat-options-toggle')).toBeVisible()
    await expect(page.getByText('Auto (recommended) · All tools on · No extra skills')).toBeVisible()
  })

  test('should open the options panel with agent, tools and skills pickers', async ({ page }) => {
    await mockCapabilities(page)
    await page.goto('/app/chat')
    await waitForHydration(page)
    await page.getByTestId('chat-options-toggle').click()
    await expect(page.getByText('Chat options')).toBeVisible()
    await expect(page.getByText('Agent', { exact: true })).toBeVisible()
    await expect(page.getByText('Tools', { exact: true })).toBeVisible()
    await expect(page.getByText('Skills', { exact: true })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'web_search' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'content-writer' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Brand voice' })).toBeVisible()
  })

  test('should narrow the tool list when an agent is selected', async ({ page }) => {
    await mockCapabilities(page)
    await page.goto('/app/chat')
    await waitForHydration(page)
    await page.getByTestId('chat-options-toggle').click()
    await page.locator('footer').getByRole('button', { name: 'Show popup' }).click()
    await page.getByRole('option', { name: 'Writer' }).click()
    await expect(page.getByRole('checkbox', { name: 'write_post' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'web_search' })).not.toBeVisible()
    await expect(page.getByText('Writer · All tools on · No extra skills')).toBeVisible()
  })

  test('should persist the selection summary across reloads', async ({ page }) => {
    await mockCapabilities(page)
    await page.goto('/app/chat')
    await waitForHydration(page)
    await page.getByTestId('chat-options-toggle').click()
    await page.locator('footer').getByRole('button', { name: 'Show popup' }).click()
    await page.getByRole('option', { name: 'Writer' }).click()
    await page.goto('/app/chat')
    await waitForHydration(page)
    await expect(page.getByText('Writer · All tools on · No extra skills')).toBeVisible()
  })
})
