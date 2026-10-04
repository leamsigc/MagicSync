import type { Page } from '@playwright/test'
import { test, expect, mockThreads } from './fixtures'
import { createTestUser, createActiveBusiness, loginWith, blockHeavyAssets, waitForHydration, type TestUser } from './helpers/e2e-utils'

/**
 * T13 plain-language surface: agent/skill/tool pickers live behind the
 * explicit Advanced switch. Default surface shows no internal vocabulary.
 */

let user: TestUser

test.beforeAll(async ({ request }) => {
  test.setTimeout(120000)
  user = await createTestUser(request)
  await createActiveBusiness(request, user)
})

async function openOptions(page: Page): Promise<void> {
  await page.locator('footer').getByLabel('Options').click()
}

test.describe('Chat advanced mode (T13)', () => {
  test('hides capability pickers by default and reveals them behind Advanced', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await mockThreads(page, [])
    await page.goto('/app/chat')
    await waitForHydration(page)
    await openOptions(page)

    const panel = page.locator('[role="dialog"]').first()
    await expect(panel.getByText('Advanced', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(panel.getByText('Agent', { exact: true })).toHaveCount(0)
    await expect(panel.getByText('Skills', { exact: true })).toHaveCount(0)

    await panel.getByRole('switch').click()
    await expect(panel.getByText('Agent', { exact: true })).toBeVisible()
    // "Skills" appears both as the section header and as a tool-group label
    await expect(panel.getByText('Skills', { exact: true }).first()).toBeVisible()

    await page.screenshot({ path: 'test-results/chat-advanced-dark.png', animations: 'disabled' })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.screenshot({ path: 'test-results/chat-advanced-light.png', animations: 'disabled' })
  })
})
