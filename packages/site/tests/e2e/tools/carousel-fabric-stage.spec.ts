import { test, expect } from '@playwright/test';
import { expectBitmap } from './fabric-bitmap';

// PRD-CAROUSEL-MCP-FABRIC Task 1.2a — FabricStage read-only renderer.
// The beta preview is gated behind `?fabric=1` so production UI is untouched.
// Loads a full layers deck, then asserts the fabric canvas paints the current
// slide (rendered > 0) and matches its golden baseline.

test.describe('fabric stage beta preview', () => {
  test('paints current slide on fabric canvas', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String((err as Error)?.stack || err)));

    await page.goto('/tools/carousel-creator?fabric=1');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="section-fabric"]')).toBeVisible({ timeout: 20000 });

    // Apply a layers-kind template (object layers, not legacy HTML) so the
    // fabric canvas has real content to paint. Deck slides are html-bound
    // (Task 1.3 conversion gap) and would only paint their background.
    const stage = page.locator('[data-testid="fabric-stage"]');
    const before = Number(await stage.getAttribute('data-render-seq') ?? 0);
    await page.locator('[data-testid="bar-layout"]').click();
    await page.locator('[data-testid="bar-layout-layer-split-screen"]').click();
    await page.waitForTimeout(600);
    const confirm = page.locator('[data-testid="btn-confirm-template"]');
    for (let i = 0; i < 3 && (await confirm.isVisible().catch(() => false)); i++) {
      await confirm.click();
      await page.waitForTimeout(400);
    }
    // Dismiss the layout popover so the golden shot shows the bare canvas.
    await page.keyboard.press('Escape');
    await page.locator('[data-testid="section-fabric"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // Gate on a NEW render completing (not a stale ready flag).
    await expect.poll(async () => Number(await stage.getAttribute('data-render-seq') ?? 0)).toBeGreaterThan(before, { timeout: 20000 });
    expect(Number(await stage.getAttribute('data-rendered'))).toBeGreaterThan(0);

    // Bitmap assertions on the true canvas buffer (see fabric-bitmap.ts).
    await expectBitmap(page, stage, {});

    expect(errors).toEqual([]);
  });

  test('stays hidden without the flag', async ({ page }) => {
    await page.goto('/tools/carousel-creator');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="control-bar"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="section-fabric"]')).toHaveCount(0);
  });
});
