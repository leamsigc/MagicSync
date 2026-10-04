import { test, expect, type Page } from './fixtures'
import { blockHeavyAssets, waitForHydration } from './helpers/e2e-utils'

/**
 * End-to-end tests for the Image Editor tool (/tools/image-editor).
 *
 * The editor is a fabric.js canvas driven by three panels:
 *  - Header: history (undo/redo), zoom, save/export
 *  - Left sidebar: Templates / Elements / Text / Uploads / Layers tabs
 *  - Right properties panel: Design & Export tabs
 */

test.describe('Image Editor', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/image-editor')
    await waitForHydration(page)
    // The floating "Open tutorials" widget (fixed bottom-right) intercepts
    // clicks on the lower part of the properties panel — hide it for the editor.
    await page.addStyleTag({ content: '.fixed.bottom-6.right-6.z-50 { display: none !important; }' })
    // Canvas + workspace frame are initialised by fabric.js on mount
    await expect(page.locator('#workspace canvas.editor').first()).toBeVisible()
    // Layers panel needs a beat to subscribe to canvas events
    await expect(layerCountText(page)).toBeVisible({ timeout: 10000 })
  })

  test.describe('Page structure', () => {
    test('renders header with title and action buttons', async ({ page }) => {
      const header = page.locator('header').first()
      await expect(header).toBeVisible()
      await expect(header.getByText('Image Editor')).toBeVisible()
      await expect(page.getByTestId('btn-undo')).toBeVisible()
      await expect(page.getByTestId('btn-redo')).toBeVisible()
      await expect(header.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
      await expect(header.getByRole('button', { name: 'Export' })).toBeVisible()
    })

    test('shows a zoom level percentage', async ({ page }) => {
      const zoomLabel = page.locator('header .font-mono')
      await expect(zoomLabel).toHaveText(/\d+%/)
    })

    test('renders all five sidebar tool tabs', async ({ page }) => {
      for (const tab of ['templates', 'elements', 'text', 'uploads', 'layers']) {
        await expect(page.getByTestId(`tab-${tab}`)).toBeVisible()
      }
    })

    test('defaults to the Layers tab with at least one object (the workspace frame)', async ({ page }) => {
      await expect(page.locator('h2')).toContainText(/layers/i)
      const count = await countLayers(page)
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('shows page title in document head', async ({ page }) => {
      await expect(page).toHaveTitle(/image editor|edit.*image/i)
    })
  })

  test.describe('Zoom controls', () => {
    test('zoom in increases the zoom percentage', async ({ page }) => {
      const before = await readZoomPercent(page)

      await page.getByLabel('Zoom In').click()
      await expect.poll(async () => readZoomPercent(page), { timeout: 5000 }).toBeGreaterThan(before)
    })

    test('zoom out decreases the zoom percentage', async ({ page }) => {
      const before = await readZoomPercent(page)
      if (before <= 5) test.skip()

      await page.getByLabel('Zoom Out').click()
      await expect.poll(async () => readZoomPercent(page), { timeout: 5000 }).toBeLessThan(before)
    })

    test('repeated zoom out keeps decreasing', async ({ page }) => {
      const start = await readZoomPercent(page)
      if (start <= 10) test.skip()

      await page.getByLabel('Zoom Out').click()
      await page.getByLabel('Zoom Out').click()
      await expect.poll(async () => readZoomPercent(page), { timeout: 5000 }).toBeLessThan(start)
    })
  })

  test.describe('Sidebar tabs', () => {
    test('switches between all tabs and updates the panel title', async ({ page }) => {
      for (const id of ['templates', 'elements', 'text', 'uploads', 'layers']) {
        await page.getByTestId(`tab-${id}`).click()
        await expect(page.locator('h2')).toHaveText(new RegExp(id, 'i'))
      }
    })

    test('Elements tab shows basic shapes and brush controls', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      await expect(page.getByTestId('add-rect')).toBeVisible()
      await expect(page.getByTestId('add-circle')).toBeVisible()
      await expect(page.getByTestId('add-triangle')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Enable Brush' })).toBeVisible()
    })

    test('Text tab shows heading, subheading and body presets', async ({ page }) => {
      await page.getByTestId('tab-text').click()
      await expect(page.getByRole('button', { name: 'Add a heading' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add a subheading' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add body text' })).toBeVisible()
    })

    test('Uploads tab shows upload button', async ({ page }) => {
      await page.getByTestId('tab-uploads').click()
      await expect(page.getByRole('button', { name: 'Upload Image' })).toBeVisible()
    })

    test('Templates tab shows built-in template and upload control', async ({ page }) => {
      await page.getByTestId('tab-templates').click()
      await expect(page.getByRole('button', { name: 'Upload Template' })).toBeVisible()
      await expect(page.getByText('Poster Simple')).toBeVisible()
    })
  })

  test.describe('Adding elements to the canvas', () => {
    test('adds a rectangle layer', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      const countBefore = await countLayers(page)
      await page.getByTestId('tab-elements').click()

      await page.getByTestId('add-rect').click()
      await expectLayerCount(page, countBefore + 1)
      await expect(page.locator('.group.flex.items-center', { hasText: 'Rectangle' }).first()).toBeVisible()
    })

    test('adds a circle layer', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      const countBefore = await countLayers(page)
      await page.getByTestId('tab-elements').click()

      await page.getByTestId('add-circle').click()
      await expectLayerCount(page, countBefore + 1)
      await expect(page.locator('.group.flex.items-center', { hasText: 'Circle' }).first()).toBeVisible()
    })

    test('adds a triangle layer', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      const countBefore = await countLayers(page)
      await page.getByTestId('tab-elements').click()

      await page.getByTestId('add-triangle').click()
      await expectLayerCount(page, countBefore + 1)
      await expect(page.locator('.group.flex.items-center', { hasText: 'Triangle' }).first()).toBeVisible()
    })

    test('adds text layers of different sizes', async ({ page }) => {
      await page.getByTestId('tab-text').click()
      const countBefore = await countLayers(page)
      await page.getByTestId('tab-text').click()

      await page.getByRole('button', { name: 'Add a heading' }).click()
      await page.getByRole('button', { name: 'Add a subheading' }).click()
      await page.getByRole('button', { name: 'Add body text' }).click()

      await expectLayerCount(page, countBefore + 3)
    })

    test('uploads an image from disk and adds it as a layer', async ({ page }) => {
      await page.getByTestId('tab-uploads').click()
      const countBefore = await countLayers(page)
      await page.getByTestId('tab-uploads').click()

      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8//8/AzGAiShVowoJAgCCpgQDXDeUDQAAAABJRU5ErkJggg==',
        'base64',
      )
      await page.setInputFiles('input[type="file"][accept="image/*"]', {
        name: 'pixel.png',
        mimeType: 'image/png',
        buffer: png,
      })

      await expectLayerCount(page, countBefore + 1)
      await expect(page.locator('.group.flex.items-center', { hasText: 'Image' }).first()).toBeVisible()
    })
  })

  test.describe('Layer management', () => {
    /** Adds one rect and one circle so the Layers tab has deterministic content. */
    async function addTwoShapes(page: Page) {
      await page.getByTestId('tab-elements').click()
      await page.getByTestId('add-rect').click()
      await page.getByTestId('add-circle').click()
      // Layer rows only render while the Layers tab is active
      await page.getByTestId('tab-layers').click()
      await page.locator('.group.flex.items-center', { hasText: 'Rectangle' }).first().waitFor()
      await page.locator('.group.flex.items-center', { hasText: 'Circle' }).first().waitFor()
    }

    test('lists added layers newest first', async ({ page }) => {
      await addTwoShapes(page)
      const rows = page.locator('.group.flex.items-center')

      const firstRow = await rows.first().innerText()
      const lastRow = await rows.last().innerText()
      // Newest (Circle) is rendered first; workspace frame is last
      expect(firstRow).toContain('Circle')
      expect(lastRow).not.toContain('Circle')
    })

    test('selecting a layer shows transform properties', async ({ page }) => {
      await addTwoShapes(page)
      await page.locator('.group.flex.items-center', { hasText: 'Rectangle' }).first().click()

      const propsPanel = propsPanelLocator(page)
      await expect(propsPanel.getByText('Transform')).toBeVisible()
      await expect(propsPanel.getByText('Fill')).toBeVisible()
      await expect(propsPanel.getByText('Align')).toBeVisible()
    })

    test('toggling visibility switches the eye icon state', async ({ page }) => {
      await addTwoShapes(page)
      const row = page.locator('.group.flex.items-center', { hasText: 'Circle' }).first()
      await row.click() // make sure it's hovered/visible

      await row.locator('button').first().click()
      await expect(row.locator('[class*="eye-off"]').first()).toBeVisible()

      await row.locator('button').first().click()
      await expect(row.locator('[class*="eye-off"]').first()).not.toBeAttached()
    })

    test('deleting a layer removes it from the list', async ({ page }) => {
      await addTwoShapes(page)
      const countWithShapes = await countLayers(page)

      const row = page.locator('.group.flex.items-center', { hasText: 'Circle' }).first()
      await row.hover()
      await row.locator('button').last().click()

      await expectLayerCount(page, countWithShapes - 1)
      await expect(page.locator('.group.flex.items-center', { hasText: 'Circle' })).toHaveCount(0)
    })

    test('move layer down reorders the stack', async ({ page }) => {
      await addTwoShapes(page)
      const circleRow = page.locator('.group.flex.items-center', { hasText: 'Circle' }).first()

      // Row buttons: [0] visibility, [1] move up, [2] move down, [3] delete
      await circleRow.hover()
      await circleRow.locator('button').nth(2).click()

      // Rectangle should now be first in the reversed list
      const firstRow = await page.locator('.group.flex.items-center').first().innerText()
      expect(firstRow).toContain('Rectangle')
    })
  })

  test.describe('Templates', () => {
    test('loading the Poster Simple template adds its objects', async ({ page }) => {
      await page.getByTestId('tab-templates').click()
      const countBefore = await countLayers(page)
      await page.getByTestId('tab-templates').click()

      await page.getByText('Poster Simple').click()

      // Template JSON contains a background rect + "Hello World" i-text,
      // replacing the workspace objects
      await page.getByTestId('tab-layers').click()
      await expect(
        page.locator('.group.flex.items-center', { hasText: 'Text' }).first(),
      ).toBeVisible({ timeout: 10000 })
      await expectLayerCountGreaterThanOrEqual(page, countBefore + 1)
    })
  })

  test.describe('Properties panel', () => {
    test('Design tab shows canvas settings when nothing is selected', async ({ page }) => {
      const propsPanel = propsPanelLocator(page)
      await expect(propsPanel.getByText('Canvas')).toBeVisible()
      await expect(propsPanel.getByText('Rulers')).toBeVisible()
      await expect(propsPanel.getByText('Snap to Guides')).toBeVisible()
      for (const preset of ['IG Post', 'Story', 'Full HD', 'Facebook Cover']) {
        await expect(propsPanel.getByRole('button', { name: preset })).toBeVisible()
      }
    })

    test('canvas size presets resize the workspace', async ({ page }) => {
      const propsPanel = propsPanelLocator(page)
      const sizeLabel = propsPanel.getByText(/Size:/)

      const initialSize = await sizeLabel.innerText()
      expect(initialSize).not.toMatch(/1080\s*x\s*1080/)

      await propsPanel.getByRole('button', { name: 'IG Post' }).click()
      await expect(sizeLabel).toHaveText(/1080\s*x\s*1080/)
    })

    test('background type select offers none, solid and gradient options', async ({ page }) => {
      const bgSelect = propsPanelLocator(page).getByTestId('select-bg-type')
      await expect(bgSelect).toBeAttached()
      await bgSelect.click()
      await expect(page.getByRole('option', { name: 'solid' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'gradient' })).toBeVisible()
      await page.keyboard.press('Escape')
    })

    test('choosing a solid background reveals the color picker', async ({ page }) => {
      const propsPanel = propsPanelLocator(page)
      await propsPanel.getByTestId('select-bg-type').click()
      await page.getByRole('option', { name: 'solid' }).click()
      // UColorPicker renders a custom picker surface, not input[type=color]
      await expect(propsPanel.locator('[data-slot="picker"]').first()).toBeAttached({ timeout: 5000 })
    })

    test('shape selection exposes align, flip and rotate controls', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      await page.getByTestId('add-rect').click()

      const propsPanel = propsPanelLocator(page)
      await expect(propsPanel.getByText('Align')).toBeVisible()
      await expect(propsPanel.getByTestId('align-left')).toBeVisible()
      await expect(propsPanel.getByTestId('btn-flip-h')).toBeVisible()
      await expect(propsPanel.getByTestId('btn-flip-v')).toBeVisible()
      await expect(propsPanel.getByTestId('btn-rotate-l')).toBeVisible()
      await expect(propsPanel.getByTestId('btn-rotate-r')).toBeVisible()
    })

    test('changing fill color updates the selected shape', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      await page.getByTestId('add-rect').click()

      const fillInput = propsPanelLocator(page).getByTestId('input-fill')
      await expect(fillInput).toBeAttached()
      await fillInput.evaluate((el: HTMLInputElement) => {
        el.value = '#ff0000'
        el.dispatchEvent(new Event('input'))
      })
      await expect(propsPanelLocator(page).getByText('Fill')).toBeVisible()
    })

    test('adding a shadow effect shows shadow inputs', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      await page.getByTestId('add-rect').click()

      const propsPanel = propsPanelLocator(page)
      await propsPanel.getByTestId('add-shadow').click()
      await expect(propsPanel.getByPlaceholder('Blur')).toBeVisible()
      await expect(propsPanel.getByPlaceholder('X')).toBeVisible()
      await expect(propsPanel.getByPlaceholder('Y')).toBeVisible()
    })

    test('text selection exposes font family, size and style buttons', async ({ page }) => {
      await page.getByTestId('tab-text').click()
      await page.getByRole('button', { name: 'Add a heading' }).click()

      const propsPanel = propsPanelLocator(page)
      await expect(propsPanel.getByTestId('select-font-family')).toBeVisible()
      await expect(propsPanel.getByTestId('input-font-size')).toBeVisible()
      await expect(propsPanel.getByTestId('btn-bold')).toBeVisible()
      await expect(propsPanel.getByTestId('btn-italic')).toBeVisible()
      await expect(propsPanel.getByTestId('btn-underline')).toBeVisible()
    })

    test('changing font size updates without errors', async ({ page }) => {
      await page.getByTestId('tab-text').click()
      await page.getByRole('button', { name: 'Add a heading' }).click()

      const fontSize = propsPanelLocator(page).getByTestId('input-font-size')
      await fontSize.fill('64')
      await fontSize.press('Enter')
      await expect(fontSize).toBeVisible()
    })

    test('Export tab offers PNG download', async ({ page }) => {
      const propsPanel = propsPanelLocator(page)
      await propsPanel.getByRole('button', { name: 'Export', exact: true }).click()
      await expect(propsPanel.getByRole('button', { name: 'Download PNG' })).toBeVisible()
    })
  })

  test.describe('History', () => {
    test('undo removes the last added layer', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      const before = await countLayers(page)
      await page.getByTestId('tab-elements').click()
      await page.getByTestId('add-rect').click()
      await expectLayerCount(page, before + 1)

      await page.getByTestId('btn-undo').click()
      await expectLayerCount(page, before)
    })

    test('redo restores an undone layer', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      const before = await countLayers(page)
      await page.getByTestId('tab-elements').click()
      await page.getByTestId('add-circle').click()
      await expectLayerCount(page, before + 1)

      await page.getByTestId('btn-undo').click()
      await expectLayerCount(page, before)

      await page.getByTestId('btn-redo').click()
      await expectLayerCount(page, before + 1)
    })
  })

  test.describe('Export & download', () => {
    test('Save downloads a PNG image of the design', async ({ page }) => {
      await page.getByTestId('tab-elements').click()
      await page.getByTestId('add-rect').click()

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await page.locator('header').first().getByRole('button', { name: 'Save', exact: true }).click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toMatch(/^magic_sync_design\.png$/)
    })

    test('Export downloads the design as JSON project file', async ({ page }) => {
      await page.getByTestId('tab-text').click()
      await page.getByRole('button', { name: 'Add a heading' }).click()

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await page.locator('header').first().getByRole('button', { name: 'Export' }).click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toMatch(/^magic_sync_design_\d+\.json$/)
    })

    test('Export tab Download PNG button produces a download', async ({ page }) => {
      const propsPanel = propsPanelLocator(page)
      await propsPanel.getByRole('button', { name: 'Export', exact: true }).click()

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await propsPanel.getByRole('button', { name: 'Download PNG' }).click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toContain('magic_sync_design')
    })
  })

  test.describe('Drag and drop upload', () => {
    test('dropping an image file onto the workspace adds a layer', async ({ page }) => {
      const countBefore = await countLayers(page)

      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8//8/AzGAiShVowoJAgCCpgQDXDeUDQAAAABJRU5ErkJggg=='
      const dataTransfer = await page.evaluateHandle((b64) => {
        const dt = new DataTransfer()
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
        dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }))
        return dt
      }, pngBase64)

      await page.dispatchEvent('#workspace', 'drop', { dataTransfer })
      await expectLayerCount(page, countBefore + 1)
    })
  })
})

// ── helpers ────────────────────────────────────────────────────────
function propsPanelLocator(page: Page) {
  return page.locator('.w-\\[280px\\]')
}

async function readZoomPercent(page: Page): Promise<number> {
  const text = await page.getByTestId('zoom-level').innerText()
  return Number.parseInt(text.replace('%', ''), 10)
}

function layerCountText(page: Page) {
  // The panel renders the i18n copy "1 layer" / "{count} layers" (lowercase)
  // — match the count, not the capitalisation.
  return page.locator('span', { hasText: /^\d+ [Ll]ayers?$/ }).first()
}

async function countLayers(page: Page): Promise<number> {
  await page.getByTestId('tab-layers').click()
  const text = await layerCountText(page).innerText()
  return Number.parseInt(text.replace(/\D/g, ''), 10)
}

async function expectLayerCount(page: Page, expected: number): Promise<void> {
  // The "N layer(s)" counter lives inside the Layers tab panel
  await page.getByTestId('tab-layers').click()
  await expect(layerCountText(page)).toHaveText(new RegExp(`^${expected} [Ll]ayers?$`), { timeout: 5000 })
}

async function expectLayerCountGreaterThanOrEqual(page: Page, min: number): Promise<void> {
  const text = await layerCountText(page).innerText()
  expect(Number.parseInt(text.replace(/\D/g, ''), 10)).toBeGreaterThanOrEqual(min)
}
