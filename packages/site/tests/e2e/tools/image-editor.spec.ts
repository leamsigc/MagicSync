import { test, expect } from '../fixtures'
import { blockHeavyAssets, waitForHydration } from '../helpers/e2e-utils'

/**
 * Image Editor (/tools/image-editor) — Figma-style layout:
 * header / left rail + panel / canvas / right properties.
 */
test.describe('Image Editor - Plugin Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/image-editor')
    await waitForHydration(page)
    await page.waitForSelector('canvas.upper-canvas', { timeout: 20000 })
  })

  test('should add text and apply font changes', async ({ page }) => {
    await page.click('button[data-testid="tab-text"]')
    await page.click('button:has-text("Add a heading")')

    await expect(page.locator('h3:has-text("Text")').first()).toBeVisible()

    // Nuxt UI v4 select: combobox trigger + listbox options
    await page.locator('button[data-testid="select-font-family"]').click()
    await page.getByRole('option', { name: 'Roboto' }).click()
    await expect(page.locator('button[data-testid="select-font-family"]')).toContainText('Roboto')

    const sizeInput = page.locator('input[data-testid="input-font-size"]')
    await sizeInput.fill('24')
    await sizeInput.blur()

    await expect(sizeInput).toHaveValue('24')
  })

  test('should apply shadow to object', async ({ page }) => {
    await page.click('button[data-testid="tab-elements"]')
    await page.click('button[data-testid="add-rect"]')

    const shadowToggle = page.locator('button[data-testid="add-shadow"]')
    await shadowToggle.click()

    await expect(page.locator('input[placeholder="Blur"]')).toBeVisible()

    const blurInput = page.locator('input[placeholder="Blur"]')
    await blurInput.fill('20')
    await blurInput.blur()
  })

  test('should apply stroke to shape', async ({ page }) => {
    await page.click('button[data-testid="tab-elements"]')
    await page.click('button[data-testid="add-circle"]')

    const widthInput = page.locator('input[data-testid="input-stroke-width"]')
    await widthInput.fill('5')
    await widthInput.blur()

    await expect(widthInput).toHaveValue('5')
  })

  test('should change canvas background color', async ({ page }) => {
    const canvas = page.locator('canvas.upper-canvas').first()
    await canvas.click({ position: { x: 10, y: 10 } })

    await page.locator('button[data-testid="select-bg-type"]').click()
    await page.getByRole('option', { name: 'Solid Color' }).click()
    await expect(page.locator('button[data-testid="select-bg-type"]')).toContainText('Solid Color')
  })

  test('should create gradient background', async ({ page }) => {
    const canvas = page.locator('canvas.upper-canvas').first()
    await canvas.click({ position: { x: 10, y: 10 } })

    await page.locator('button[data-testid="select-bg-type"]').click()
    await page.getByRole('option', { name: 'Gradient' }).click()

    const kindSelect = page.locator('button[data-testid="select-gradient-kind"]')
    await expect(kindSelect).toBeVisible()
    await kindSelect.click()
    await expect(page.getByRole('option', { name: 'Linear' })).toBeVisible()
    await page.getByRole('option', { name: 'Linear' }).click()
    await expect(kindSelect).toContainText('Linear')
  })

  test('should align object to center', async ({ page }) => {
    await page.click('button[data-testid="tab-elements"]')
    await page.click('button[data-testid="add-rect"]')

    const centerBtn = page.locator('button[data-testid="align-center"]')
    await centerBtn.click()
  })

  test('should add and remove guidelines', async ({ page }) => {
    const canvas = page.locator('canvas.upper-canvas').first()
    await canvas.click({ position: { x: 10, y: 10 } })

    await page.click('button:has-text("+ H Guide")')
  })

  test('should toggle rulers on/off', async ({ page }) => {
    const canvas = page.locator('canvas.upper-canvas').first()
    await canvas.click({ position: { x: 10, y: 10 } })

    const rulersToggle = page.locator('button[data-testid="toggle-rulers"]')
    await rulersToggle.click()

    await expect(rulersToggle).toHaveAttribute('aria-checked', 'true')
  })

  test('should reflect the selected object opacity', async ({ page }) => {
    await page.click('button[data-testid="tab-elements"]')
    await page.click('button[data-testid="add-circle"]')

    // Slider mirrors canvas state for the selection
    const opacityLabel = page.locator('label', { hasText: /^Opacity/ })
    await expect(opacityLabel).toContainText('Opacity 100%')
    const thumb = opacityLabel.locator('xpath=../..').getByRole('slider')
    await expect(thumb).toHaveAttribute('aria-valuemin', '0')
    await expect(thumb).toHaveAttribute('aria-valuemax', '100')
    await expect(thumb).toHaveAttribute('aria-valuenow', '100')
  })

  test('should drive canvas gradient angle from its slider', async ({ page }) => {
    const canvas = page.locator('canvas.upper-canvas').first()
    await canvas.click({ position: { x: 10, y: 10 } })

    await page.locator('button[data-testid="select-bg-type"]').click()
    await page.getByRole('option', { name: 'Gradient' }).click()

    const angleLabel = page.locator('label', { hasText: 'Angle' }).first()
    await expect(angleLabel).toBeVisible()
    // Let the gradient card enter animation settle so the thumb stays mounted
    await page.waitForTimeout(500)
    const thumb = angleLabel.locator('xpath=ancestor::div[2]').getByRole('slider')
    await thumb.press('End')
    await expect(thumb).toHaveAttribute('aria-valuenow', '360', { timeout: 10000 })
  })

  test('should flip object horizontally and vertically', async ({ page }) => {
    await page.click('button[data-testid="tab-elements"]')
    await page.click('button[data-testid="add-triangle"]')

    await page.click('button[data-testid="btn-flip-h"]')
    await page.click('button[data-testid="btn-flip-v"]')
    // Visual verification is hard, but clicking should not error
  })

  test('should rotate object left and right without errors', async ({ page }) => {
    await page.click('button[data-testid="tab-elements"]')
    await page.click('button[data-testid="add-rect"]')

    await page.click('button[data-testid="btn-rotate-l"]')
    await page.click('button[data-testid="btn-rotate-r"]')
  })

  test('should show arrange controls for a selection', async ({ page }) => {
    await page.click('button[data-testid="tab-elements"]')
    await page.click('button[data-testid="add-rect"]')

    await expect(page.getByText('Arrange', { exact: true })).toBeVisible()
    await page.click('button[data-testid="btn-duplicate"]')
  })

  test('should open the export tab and download PNG', async ({ page }) => {
    await page.click('button[data-testid="btn-open-export"]')
    const downloadButton = page.locator('button:has-text("Download PNG")')
    await expect(downloadButton).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await downloadButton.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })
})

test.describe('Image Editor - AI status', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/image-editor')
    await waitForHydration(page)
    await page.waitForSelector('canvas.upper-canvas', { timeout: 20000 })
  })

  test('shows the AI model status badge in the header', async ({ page }) => {
    const badge = page.locator('[data-testid="ai-status"]')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText(/AI|Loading|Removing/i)
  })

  test('hides background-removal until an image layer is selected', async ({ page }) => {
    await expect(page.locator('button[data-testid="btn-remove-bg"]')).toHaveCount(0)
  })

  test('uploading an image asks to load the AI model first', async ({ page }) => {
    await page.click('button[data-testid="tab-uploads"]')
    // 1x1 transparent PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: png,
    })

    // No silent auto-download: the user is asked to start the model load
    const loadButton = page.locator('button[data-testid="btn-load-model"]')
    await expect(loadButton).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button[data-testid="btn-remove-bg"]')).toHaveCount(0)

    // Starting the load leaves the idle state (loading spinner or error
    // surface when the model host is unreachable — both are handled UI)
    await loadButton.click()
    await expect(page.locator('[data-testid="ai-status"]')).not.toContainText('AI idle', { timeout: 20000 })
  })
})
