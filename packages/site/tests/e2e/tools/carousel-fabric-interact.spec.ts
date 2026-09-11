import { test, expect } from '@playwright/test';
import { applyLayoutTemplate } from './carousel-helpers';

// PRD-CAROUSEL-MCP-FABRIC Task 1.2b — interactive fabric editing.
// Split Screen layers are [background, image, kicker, headline, body], so the
// headline Textbox is layer index 3. Click-select flows into the layers panel
// selection (data-selected); dragging writes the transform back to the slide
// (proven by the DOM stage text moving, not just the canvas object).

test.describe('fabric stage interaction', () => {
  test('click selects the headline layer, empty click clears', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String((err as Error)?.stack || err)));

    await page.goto('/tools/carousel-creator?fabric=1');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts?.ready);
    const stage = page.locator('[data-testid="fabric-stage"]');
    await expect(stage).toBeVisible({ timeout: 20000 });
    await applyLayoutTemplate(page, stage, 'layer-split-screen');

    // The beta section sits below the fold — mouse coordinates only land
    // while the canvas is inside the viewport.
    await stage.scrollIntoViewIfNeeded();
    const box = await stage.locator('canvas.lower-canvas').boundingBox();
    expect(box).not.toBeNull();
    const at = async (cx: number, cy: number): Promise<{ x: number, y: number }> => {
      const scale = box!.width / 1080;
      return { x: box!.x + cx * scale, y: box!.y + cy * scale };
    };
    const headline = await at(750, 560);
    await page.mouse.click(headline.x, headline.y);
    await expect.poll(async () => stage.getAttribute('data-selected')).toBe('3');

    // Empty click on the locked background clears. Point near the top-right
    // stays inside the viewport after scrollIntoView (canvas bottom is not).
    const empty = await at(1000, 100);
    await page.mouse.click(empty.x, empty.y);
    await expect.poll(async () => stage.getAttribute('data-selected')).toBe('-1');

    expect(errors).toEqual([]);
  });

  test('dragging the headline writes back to the slide', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String((err as Error)?.stack || err)));

    await page.goto('/tools/carousel-creator?fabric=1');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts?.ready);
    const stage = page.locator('[data-testid="fabric-stage"]');
    await expect(stage).toBeVisible({ timeout: 20000 });
    await applyLayoutTemplate(page, stage, 'layer-split-screen');

    // DOM proof: the editor's own stage text must move, not just the canvas.
    const headline = page.getByText('Make every pixel count', { exact: true }).first();
    const beforeBox = await headline.boundingBox();
    expect(beforeBox).not.toBeNull();

    await stage.scrollIntoViewIfNeeded();
    const box = await stage.locator('canvas.lower-canvas').boundingBox();
    expect(box).not.toBeNull();
    const scale = box!.width / 1080;
    const startX = box!.x + 750 * scale;
    const startY = box!.y + 560 * scale;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => (await headline.boundingBox())?.x ?? 0).toBeGreaterThan((beforeBox?.x ?? 0) + 30);
    expect(errors).toEqual([]);
  });
});
