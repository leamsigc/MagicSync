import { test, expect, type Page } from '@playwright/test'
import { mockAuthSession } from '../fixtures'

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

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await mockSingleBusiness(page)
    await page.goto('/app/chat')
  })

  test('should display the chat welcome message', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible()
    await expect(page.getByText('Say it in your own words. I will do the research and the work.')).toBeVisible()
  })

  test('should show suggestion buttons when chat is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Help me get more customers.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Make me a great post for Facebook.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Give me 10 Facebook ideas about my business.' })).toBeVisible()
  })

  test('should show attach and input controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add file' })).toBeVisible()
    await expect(page.getByPlaceholder('Tell me what you need...')).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'First, add your business' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add my business' })).toBeVisible()
  })

  test('should show the options button with the default selection summary', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Options' })).toBeVisible()
    await expect(page.getByText('Auto (recommended) · All tools on · No extra skills')).toBeVisible()
  })

  test('should open the options panel with agent, tools and skills pickers', async ({ page }) => {
    await mockCapabilities(page)
    await page.goto('/app/chat')
    await page.getByRole('button', { name: 'Options' }).click()
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
    await page.getByRole('button', { name: 'Options' }).click()
    await page.locator('footer').getByRole('button', { name: 'Show popup' }).click()
    await page.getByRole('option', { name: 'Writer' }).click()
    await expect(page.getByRole('checkbox', { name: 'write_post' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'web_search' })).not.toBeVisible()
    await expect(page.getByText('Writer · All tools on · No extra skills')).toBeVisible()
  })

  test('should persist the selection summary across reloads', async ({ page }) => {
    await mockCapabilities(page)
    await page.goto('/app/chat')
    await page.getByRole('button', { name: 'Options' }).click()
    await page.locator('footer').getByRole('button', { name: 'Show popup' }).click()
    await page.getByRole('option', { name: 'Writer' }).click()
    await page.goto('/app/chat')
    await expect(page.getByText('Writer · All tools on · No extra skills')).toBeVisible()
  })
})
