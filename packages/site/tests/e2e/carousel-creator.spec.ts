import { test, expect } from './fixtures'
import { blockHeavyAssets, waitForHydration } from './helpers/e2e-utils'

/**
 * End-to-end tests for the Instagram Carousel Creator (/tools/carousel-creator).
 *
 * The page renders HTML-template slides (no fabric canvas):
 *  - Stage: scaled live preview of the active slide (#carousel-stage)
 *  - Aside: slide rail, deck panel (handle + background flow), style panel
 *    with card-preview layouts, media panel, per-slide export
 *  - Action bar under the stage: download / save all / use in post
 */

// 1x1 transparent PNG used to satisfy the wide-image picker in flow tests
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Instagram Carousel Creator', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/carousel-creator')
    await waitForHydration(page)
    // Floating "Open tutorials" widget can overlap panel controls — hide it
    await page.addStyleTag({ content: '.fixed.bottom-6.right-6.z-50 { display: none !important; }' })
    await expect(page.locator('#carousel-stage')).toBeVisible()
    await expect(page.getByTestId('slide-counter')).toHaveText('1/1')
  })

  test('renders studio, stage, slide manager and control bar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /carousel studio/i })).toBeVisible()
    await expect(page.getByTestId('slide-manager')).toBeVisible()
    await expect(page.getByTestId('control-bar')).toBeVisible()
    await expect(page.getByTestId('pill-download')).toBeVisible()
    await expect(page.getByTestId('pill-save-all')).toBeVisible()
    await expect(page.getByTestId('pill-use-in-post')).toBeVisible()
    await expect(page.getByTestId('deck-panel')).toBeVisible()
    await expect(page.getByTestId('layout-card-title-kicker')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('dial-rotate')).toHaveAttribute('aria-valuenow', '0')
  })

  test('adding two slides grows the strip to three and navigation works', async ({ page }) => {
    await page.getByTestId('btn-add-slide').click()
    await expect(page.getByTestId('slide-counter')).toHaveText('2/2')
    await page.getByTestId('btn-add-slide').click()
    await expect(page.getByTestId('slide-counter')).toHaveText('3/3')
    await expect(page.locator('[data-testid^="slide-thumb-"]')).toHaveCount(3)

    await page.getByTestId('btn-prev-slide').click()
    await expect(page.getByTestId('slide-counter')).toHaveText('2/3')
    await page.getByTestId('btn-prev-slide').click()
    await expect(page.getByTestId('slide-counter')).toHaveText('1/3')
    await page.getByTestId('btn-next-slide').click()
    await expect(page.getByTestId('slide-counter')).toHaveText('2/3')
  })

  test('headline edits update the live stage', async ({ page }) => {
    await page.getByTestId('field-headline').fill('Design faster than ever')
    await expect(page.locator('#carousel-stage')).toContainText('Design faster than ever')
  })

  test('layout cards preview templates and switching updates the stage', async ({ page }) => {
    await expect(page.locator('[data-testid^="layout-card-"]')).toHaveCount(13)

    await page.getByTestId('layout-card-quote').click()
    await expect(page.getByTestId('layout-card-quote')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('layout-card-title-kicker')).toHaveAttribute('data-active', 'false')
    // Quote template renders a decorative ldquo mark
    await expect(page.locator('#carousel-stage')).toContainText('“')
  })

  test('plane flow stretches one continuous plane across the deck', async ({ page }) => {
    await page.getByTestId('flow-mode-plane').click()
    await expect(page.getByTestId('flow-mode-plane')).toHaveAttribute('data-active', 'true')

    // Single slide: plane spans one frame
    await expect(page.locator('#carousel-stage')).toContainText('linear-gradient(90deg')

    await page.getByTestId('btn-add-slide').click()
    // Slide 2 shows the offset window of the deck-wide plane (2 frames wide)
    const stageHtml = await page.locator('#carousel-stage').innerHTML()
    expect(stageHtml).toContain('width:2160px')
    expect(stageHtml).toContain('left:-1080px')
  })

  test('pan run slices one wide image across slides after the cover', async ({ page }) => {
    await page.getByTestId('btn-add-slide').click()
    await page.getByTestId('btn-add-slide').click()
    await page.getByTestId('flow-mode-pan').click()
    await expect(page.getByTestId('flow-pan-count')).toBeVisible()

    // No image yet — no pan layer anywhere
    await page.getByTestId('btn-prev-slide').click()
    await page.getByTestId('btn-prev-slide').click()
    await expect(page.getByTestId('slide-counter')).toHaveText('1/3')
    await expect(page.locator('#carousel-stage')).not.toContainText('object-fit:cover')

    // Upload a wide shot; slides 2-3 become slices of the same image
    const fileInput = page.getByTestId('flow-panel').locator('input[type="file"]').first()
    await fileInput.setInputFiles({ name: 'wide-shot.png', mimeType: 'image/png', buffer: TINY_PNG })
    await page.getByTestId('btn-next-slide').click()
    await expect(page.locator('#carousel-stage img')).toHaveCount(1)
    // Slide 2 holds the first slice of the 2-frame plane
    let stageHtml = await page.locator('#carousel-stage').innerHTML()
    expect(stageHtml).toContain('left:0px;width:2160px')
    await page.getByTestId('btn-next-slide').click()
    // Slide 3 holds the second slice
    stageHtml = await page.locator('#carousel-stage').innerHTML()
    expect(stageHtml).toContain('left:-1080px;width:2160px')
  })

  test('user handle renders in the slide footer', async ({ page }) => {
    await page.getByTestId('field-handle').fill('@magicsync')
    await expect(page.locator('#carousel-stage')).toContainText('@magicsync')
  })

  test('control bar dials scrub rotate/zoom/pattern and reset', async ({ page }) => {
    const rotate = page.getByTestId('dial-rotate')
    await rotate.focus()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await expect(rotate).toHaveAttribute('aria-valuenow', '10')

    // Zoom dial drives the content scale effect
    await page.getByTestId('dial-zoom').focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('dial-zoom')).toHaveAttribute('aria-valuenow', '95')

    // Double-click resets to default
    await rotate.dblclick()
    await expect(rotate).toHaveAttribute('aria-valuenow', '0')
  })

  test('safe-area guides toggle on the stage only', async ({ page }) => {
    await expect(page.getByTestId('stage-guides')).toHaveCount(0)
    await page.getByTestId('bar-guides').click()
    await expect(page.getByTestId('stage-guides')).toBeVisible()
    await expect(page.locator('#carousel-export-stage')).not.toContainText('grid-cols-3')
  })

  test('aspect control switches the frame between 4:5 and 1:1', async ({ page }) => {
    await expect(page.getByTestId('bar-aspect')).toHaveText('4:5')
    await page.getByTestId('bar-aspect').click()
    await expect(page.getByTestId('bar-aspect')).toHaveText('1:1')
    const size = await page.locator('#carousel-stage').boundingBox()
    expect(size).toBeTruthy()
    expect(size!.width).toBeCloseTo(size!.height!,  0)

    // Frame preset popover switches back to portrait
    await page.getByTestId('bar-frame').click()
    await page.getByTestId('bar-frame-portrait').click()
    await expect(page.getByTestId('bar-aspect')).toHaveText('4:5')
  })

  test('control bar layout popover applies templates', async ({ page }) => {
    await page.getByTestId('bar-layout').click()
    await page.getByTestId('bar-layout-quote').click()
    await expect(page.getByTestId('layout-card-quote')).toHaveAttribute('data-active', 'true')
    await expect(page.locator('#carousel-stage')).toContainText('“')
  })

  test('per-slide download fires a carousel_01.png file', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await page.getByTestId('pill-download').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^carousel_01\.png$/)
  })

  test('save all while signed out shows the login-required toast', async ({ page }) => {
    await page.getByTestId('pill-save-all').click()
    await expect(
      page.locator('[data-slot="title"]', { hasText: /sign in to save|inicia sesión|connectez-vous|melde dich an/i }),
    ).toBeVisible({ timeout: 15000 })
  })

  test('AI design mode prompts login when signed out', async ({ page }) => {
    await page.getByTestId('bar-mode').getByRole('button', { name: /ai design/i }).click()
    await expect(page.getByTestId('ai-panel')).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible()
  })
})
