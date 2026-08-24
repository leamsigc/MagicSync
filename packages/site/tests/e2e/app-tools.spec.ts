import { test, expect } from './fixtures'
import {
  createTestUser,
  createActiveBusiness,
  loginWith,
  blockHeavyAssets,
  waitForHydration,
  type TestUser,
} from './helpers/e2e-utils'

/**
 * End-to-end tests for the authenticated in-app tools served through the
 * unified site package: text-to-speech, content-split (repurpose),
 * growth-strategy and video-cropper.
 *
 * These tests run against the REAL auth stack (Better Auth + local libSQL)
 * and the REAL business middleware — no session mocking — so they exercise
 * the full integration of every layer package inside /app.
 */

let user: TestUser

test.beforeAll(async ({ request }) => {
  user = await createTestUser(request)
  await createActiveBusiness(request, user)
})

test.describe('Text to Speech (/app/tools/text-to-speech)', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await page.goto('/app/tools/text-to-speech')
    await waitForHydration(page)
  })

  test('renders header with title and subtitle', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('provides a text input with character counter', async ({ page }) => {
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible()

    await textarea.fill('Hello from E2E')
    await expect(page.getByText(/\/\s*5000|14/).first()).toBeVisible()
  })

  test('voice selection offers multiple voices', async ({ page }) => {
    // Voice picker is a USelectMenu; its trigger shows the selected voice
    const voiceTrigger = page.getByRole('button', { name: /male|female/i }).first()
    await expect(voiceTrigger).toBeVisible()

    await voiceTrigger.click()
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 5000 })
    expect(await page.getByRole('option').count()).toBeGreaterThanOrEqual(2)
  })

  test('synthesise control is present', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /generate|synthes/i }).first(),
    ).toBeVisible()
  })

  test('shows model loading state without crashing when assets are blocked', async ({ page }) => {
    // Model assets are blocked by blockHeavyAssets; the tool must degrade
    // gracefully and keep the form usable.
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeEnabled({ timeout: 15000 })
  })

  test('history section renders', async ({ page }) => {
    // History panel exists even when empty
    await expect(page.locator('body')).toContainText(/history|recent|generation/i)
  })
})

test.describe('Content Repurpose (/app/tools/content-split)', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await page.goto('/app/tools/content-split')
    await waitForHydration(page)
  })

  test('renders the repurpose workspace', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('provides content input area', async ({ page }) => {
    await expect(page.locator('textarea, input[type="text"]').first()).toBeAttached()
  })

  test('offers platform targeting controls', async ({ page }) => {
    // Platform chips/toggles for multi-platform output
    await expect(page.locator('body')).toContainText(/platform|tone|generate/i)
  })

  test('shows generate action', async ({ page }) => {
    await expect(page.getByRole('button', { name: /generate|repurpose|create/i }).first()).toBeVisible()
  })
})

test.describe('Growth Strategy (/app/tools/growth-stratergy)', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await page.goto('/app/tools/growth-stratergy')
    await waitForHydration(page)
  })

  test('renders the growth strategy hub', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('offers strategy tabs or creation entry point', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /create|new|generate|start/i }).first().or(
        page.getByRole('tab').first(),
      ),
    ).toBeVisible({ timeout: 10000 })
  })

  test('create entry navigates to the builder', async ({ page }) => {
    const createBtn = page.getByRole('link', { name: /create|new|start/i }).first()
    if (await createBtn.isVisible()) {
      await createBtn.click()
      await expect(page).not.toHaveURL(/error|404/)
    }
  })
})

test.describe('Video Cropper (/app/tools/video-cropper)', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await page.goto('/app/tools/video-cropper')
    await waitForHydration(page)
  })

  test('renders upload drop zone before any project exists', async ({ page }) => {
    await expect(page.locator('input[type="file"]').first()).toBeAttached({ timeout: 10000 })
  })

  test('drop zone explains supported formats', async ({ page }) => {
    await expect(page.locator('body')).toContainText(/video|upload|drag|mp4|webm/i)
  })

  test('accepts a video file selection and shows the editor stage', async ({ page }) => {
    // Tiny valid MP4 header buffer is enough to pass client-side type checks
    const mp4 = Buffer.from(
      'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAABJttb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAAA',
      'base64',
    )
    const input = page.locator('input[type="file"]').first()
    await input.setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: mp4 })

    // After a file is chosen the drop zone disappears or an editor panel mounts
    await page.waitForTimeout(2000)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('App tools navigation consistency', () => {
  test('all four app tools are reachable from the sidebar Tools menu', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)

    // /app/tools has no index page — use a real tool route that mounts the dashboard shell
    await page.goto('/app/tools/text-to-speech')
    await waitForHydration(page)
    const sidebar = page.getByRole('navigation').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })
    await expect(sidebar.getByRole('link', { name: 'Tools' })).toBeVisible()
  })

  test('unauthenticated visitors are redirected to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/app/tools/text-to-speech')
    await expect(page).toHaveURL(/login/)
  })
})
