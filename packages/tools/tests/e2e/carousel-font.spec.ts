import { test, expect } from '@playwright/test';

// Regression: selecting a slide template and changing the deck font used to
// throw `TypeError: can't access property "replace"` from esc() in
// templates.ts (nil palette colors / sparse slide data reaching the renderers).
// See patterns/carousel-deck-templates.md "Nil-safe rendering".
test.describe('Carousel creator font change', () => {
  test('applying templates and cycling deck fonts throws no page errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String((err as Error)?.stack || err)))

    await page.goto('/tools/carousel-creator')
    await page.waitForLoadState('networkidle')
    // The deck font select lives in the collapsible brand panel — expand it
    // first and assert visibility (clicks during hydration can get lost).
    await page.getByRole('button', { name: /brand & background flow/i }).click()
    await expect(page.locator('[data-testid="font-select"]')).toBeVisible({ timeout: 15000 })

    // Load a full deck so slides carry realistic data, then exercise the
    // previously-crashing templates (timeline, image-focus) plus a control.
    await page.getByRole('button', { name: 'Use deck' }).first().click()

    for (const tpl of ['Timeline', 'Image Focus', 'Quote']) {
      await page.locator('aside').getByRole('button', { name: new RegExp(tpl) }).first().click()
      // Template apply asks for confirmation on customised slides — the modal
      // animates in, so allow it a moment to appear before checking.
      await page.waitForTimeout(600)
      const confirm = page.locator('[data-testid="btn-confirm-template"]')
      for (let i = 0; i < 3 && (await confirm.isVisible().catch(() => false)); i++) {
        await confirm.click()
        await page.waitForTimeout(400)
      }
      await page.locator('[data-testid="font-select"]').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="font-select"]').click()
      await page.getByRole('option', { name: 'Impact' }).click()
      await page.waitForTimeout(400)
    }

    expect(errors).toEqual([])
  })
})
