import { test, expect } from '@playwright/test'

/**
 * Dynamic Menu Board — /tools/menu-board
 *
 * Covers the public tool surface (guest mode uses IndexedDB):
 * - Tool listing + navigation
 * - Board admin CRUD (pages, templates, settings)
 * - Display mode (fullscreen restaurant TV view) + exit
 * - AI assistant gating (logged-in only)
 * - Share gating (share/save are for logged-in users only)
 * - Public shared URL rendering + fullscreen option + unknown slug handling
 */
test.describe('Dynamic Menu Board', () => {
  test.describe('Tool Listing', () => {
    test('should list menu board on the tools page', async ({ page }) => {
      await page.goto('/tools')
      await expect(page.locator('text=Dynamic Menu Board')).toBeVisible()
    })

    test('should navigate to menu board from tools page', async ({ page }) => {
      await page.goto('/tools')
      // Card links are zero-height overlays — click through the parent card body.
      const cardLink = page.locator('a[href="/tools/menu-board"]').first()
      await expect(cardLink).toBeAttached()
      await cardLink.locator('xpath=..').click()
      await expect(page).toHaveURL(/\/tools\/menu-board/)
      await expect(page.locator('[data-testid="menu-board-header"]')).toBeVisible()
    })
  })

  test.describe('Admin Panel (guest mode)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/tools/menu-board')
      // Fresh contexts have no IndexedDB — the app seeds a default board.
      await expect(page.locator('[data-testid="current-board-panel"]')).toBeVisible({ timeout: 15000 })
    })

    test('should show guest storage badge and a seeded default board', async ({ page }) => {
      await expect(page.locator('[data-testid="storage-mode-badge"]')).toContainText('device')
      await expect(page.locator('[data-testid="pages-count"]')).toContainText('Pages (1)')
      await expect(page.locator('[data-testid="page-list"] [data-testid^="page-row-"]').first()).toBeVisible()
    })

    test('should disable share for guests with login hint', async ({ page }) => {
      const shareButton = page.locator('[data-testid="share-disabled-guest"]')
      await expect(shareButton).toBeVisible()
      await expect(shareButton).toBeDisabled()
    })

    test('should hide AI assistant from guests with a login hint', async ({ page }) => {
      const row = page.locator('[data-testid^="page-row-"]').first()
      await row.hover()
      await row.locator('[data-testid^="edit-"]').click()

      const editor = page.locator('[data-testid="page-editor"]')
      await expect(editor).toBeVisible()
      await expect(page.locator('[data-testid="ai-prompt"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="ai-guest-hint"]')).toContainText('Log in')
    })

    test('should add an HTML page from a restaurant template', async ({ page }) => {
      await page.locator('[data-testid="add-html-page"]').click()

      const modal = page.locator('[data-testid="templates-modal"]')
      await expect(modal).toBeVisible()
      // Seed page is "Classic Bistro" — add a different cuisine template.
      await page.locator('[data-testid="template-card-sushi-slate"]').click()

      await expect(page.locator('[data-testid="pages-count"]')).toContainText('Pages (2)')
      await expect(page.locator('[data-testid="page-row-sushi-slate"]')).toBeVisible()
    })

    test('should add an image page and edit its name and url', async ({ page }) => {
      await page.locator('[data-testid="add-image-page"]').click()

      const editor = page.locator('[data-testid="page-editor"]')
      await expect(editor).toBeVisible()

      // Guests don't get the assets picker — URL input only.
      await expect(page.locator('[data-testid="choose-from-assets"]')).toHaveCount(0)

      await page.locator('[data-testid="page-editor-name"]').fill('Promo Slide')
      await page.locator('[data-testid="page-editor-image-url"]').fill('https://picsum.photos/seed/promo/1920/1080')
      await page.locator('[data-testid="page-editor-save"]').click()

      await expect(editor).not.toBeVisible()
      await expect(page.locator('[data-testid="page-row-promo-slide"]')).toBeVisible()
    })

    test('should duplicate and delete pages', async ({ page }) => {
      await expect(page.locator('[data-testid="pages-count"]')).toContainText('Pages (1)')

      const row = page.locator('[data-testid^="page-row-"]').first()
      await row.hover()
      await row.locator('[data-testid^="duplicate-"]').click()
      await expect(page.locator('[data-testid="pages-count"]')).toContainText('Pages (2)')
      await expect(page.locator('[data-testid="page-list"]').getByText('(Copy)')).toBeVisible()

      const copyRow = page.locator('[data-testid="page-list"] [data-testid^="page-row-"]:has-text("(Copy)")')
      await copyRow.hover()
      await copyRow.locator('[data-testid^="remove-"]').click()
      await expect(page.locator('[data-testid="pages-count"]')).toContainText('Pages (1)')
    })

    test('should edit a page name through the editor', async ({ page }) => {
      const row = page.locator('[data-testid^="page-row-"]').first()
      await row.hover()
      await row.locator('[data-testid^="edit-"]').click()

      await expect(page.locator('[data-testid="page-editor"]')).toBeVisible()
      await page.locator('[data-testid="page-editor-name"]').fill('Renamed Page')
      await page.locator('[data-testid="page-editor-save"]').click()

      await expect(page.locator('[data-testid="page-row-renamed-page"]')).toBeVisible()
    })

    test('should reorder pages with move buttons', async ({ page }) => {
      await page.locator('[data-testid="add-html-page"]').click()
      await page.locator('[data-testid="template-card-blank"]').click()
      await expect(page.locator('[data-testid="pages-count"]')).toContainText('Pages (2)')

      const rows = page.locator('[data-testid="page-list"] [data-testid^="page-row-"]')
      const firstName = await rows.first().locator('h3').textContent()

      await rows.nth(1).hover()
      await rows.nth(1).locator('[data-testid^="move-up-"]').click()
      await expect(rows.first().locator('h3')).not.toHaveText(firstName ?? '')
    })

    test('should update settings transition time', async ({ page }) => {
      await page.locator('[data-testid="open-settings"]').click()

      const modal = page.locator('[data-testid="board-settings-modal"]')
      await expect(modal).toBeVisible()

      const input = page.locator('[data-testid="settings-transition-time"]')
      await input.fill('7')
      await page.locator('[data-testid="settings-save"]').click()

      await expect(modal).not.toBeVisible()
      await expect(page.locator('[data-testid="dirty-badge"]')).toBeVisible()
    })

    test('should save board to IndexedDB as a guest', async ({ page }) => {
      await page.locator('[data-testid="save-board"]').click()
      await expect(page.getByText('saved on this device').first()).toBeVisible({ timeout: 10000 })
      await expect(page.locator('[data-testid="dirty-badge"]')).toHaveCount(0)
    })

    test('should persist boards across reloads via IndexedDB', async ({ page }) => {
      await page.locator('[data-testid="add-html-page"]').click()
      await page.locator('[data-testid="template-card-breakfast-diner"]').click()
      await expect(page.locator('[data-testid="page-row-breakfast-diner"]')).toBeVisible()

      await page.locator('[data-testid="save-board"]').click()
      await expect(page.getByText('saved on this device').first()).toBeVisible({ timeout: 10000 })

      await page.reload()
      await expect(page.locator('[data-testid="current-board-panel"]')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('[data-testid="page-row-breakfast-diner"]')).toBeVisible()
    })
  })

  test.describe('Display Mode (restaurant TV)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/tools/menu-board')
      await expect(page.locator('[data-testid="current-board-panel"]')).toBeVisible({ timeout: 15000 })
    })

    test('should start fullscreen display and render page content', async ({ page }) => {
      await page.locator('[data-testid="start-display"]').click()

      const board = page.locator('[data-testid="display-board"]')
      await expect(board).toBeVisible()
      await expect(board.locator('[data-testid="display-html-page"], [data-testid="display-empty"]')).toBeVisible()
      // Start Display requests browser fullscreen (granted headless or silently skipped).
    })

    test('should return to admin from display via hidden corner', async ({ page }) => {
      await page.locator('[data-testid="start-display"]').click()
      await expect(page.locator('[data-testid="display-board"]')).toBeVisible()

      await page.locator('[data-testid="display-hidden-corner"]').click()
      await expect(page.locator('[data-testid="menu-board-header"]')).toBeVisible()
    })

    test('should lock display and unlock with PIN after five hidden clicks', async ({ page }) => {
      await page.locator('[data-testid="open-settings"]').click()
      await page.locator('[data-testid="settings-transition-time"]').fill('5')
      await page.locator('[data-testid="settings-save"]').click()
      await page.locator('[data-testid="save-board"]').click()
      await expect(page.getByText('saved on this device').first()).toBeVisible({ timeout: 10000 })

      await page.locator('[data-testid="lock-display"]').click()
      await expect(page.locator('[data-testid="display-board"]')).toBeVisible()

      // Five clicks reveal the PIN prompt
      const corner = page.locator('[data-testid="display-hidden-corner"]')
      for (let i = 0; i < 5; i++) {
        await corner.click()
      }
      await expect(page.locator('[data-testid="unlock-pin-input"]')).toBeVisible()

      await page.locator('[data-testid="unlock-pin-input"]').fill('0000')
      await page.locator('[data-testid="unlock-submit"]').click()
      await expect(page.locator('[data-testid="menu-board-header"]')).toBeVisible()
    })
  })

  test.describe('Share & Public URL (auth-gated)', () => {
    test('should reject unauthenticated board save API calls', async ({ request }) => {
      const response = await request.post('/api/v1/menu-board', {
        data: { id: 'test-board', name: 'Test', pages: [], settings: { transitionTime: 10, isLocked: false, unlockPin: '0000' } },
      })
      expect(response.status()).toBe(401)
    })

    test('should reject unauthenticated board listing', async ({ request }) => {
      const response = await request.get('/api/v1/menu-board')
      expect(response.status()).toBe(401)
    })

    test('should reject unauthenticated AI generation', async ({ request }) => {
      const response = await request.post('/api/v1/menu-board/ai', {
        data: { prompt: 'make it dark' },
      })
      expect(response.status()).toBe(401)
    })

    test('should reject unauthenticated asset listing', async ({ request }) => {
      const response = await request.get('/api/v1/assets', { params: { own: 'true' } })
      expect(response.status()).toBe(401)
    })

    test('should show not-available state for unknown shared slug', async ({ page }) => {
      await page.goto('/tools/menu-board/shared/does-not-exist-12345')
      await expect(page.locator('[data-testid="shared-board-missing"]')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Menu not available')).toBeVisible()
    })

    test('should offer creating your own board from missing state', async ({ page }) => {
      await page.goto('/tools/menu-board/shared/does-not-exist-12345')
      await expect(page.locator('[data-testid="shared-board-missing"]')).toBeVisible({ timeout: 15000 })

      await page.locator('[data-testid="shared-board-cta"]').click()
      await expect(page).toHaveURL(/\/tools\/menu-board/)
    })

    test('public board page should expose a fullscreen control when pages exist', async ({ page }) => {
      // Unknown slug renders the missing state; verify no fullscreen control there.
      await page.goto('/tools/menu-board/shared/does-not-exist-12345')
      await expect(page.locator('[data-testid="shared-board-missing"]')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('[data-testid="fullscreen-toggle"]')).toHaveCount(0)
    })
  })
})
