import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Shared beta-preview interactions (PRD-CAROUSEL-MCP-FABRIC).
 *
 * Applies a layout template through the control-bar popover and waits for a
 * NEW fabric render. Retries the popover flow: the 40-option popover
 * interaction is occasionally swallowed (no slide change → no new render),
 * and re-applying is idempotent. Clipped options can't be pointer-clicked
 * (popover overflows the viewport), so the option click is dispatched — the
 * render-seq gate proves the Vue handler fired.
 */
export async function applyLayoutTemplate(page: Page, stage: Locator, key: string): Promise<void> {
  const before = Number(await stage.getAttribute('data-render-seq') ?? 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator('[data-testid="bar-layout"]').click();
    await page.locator(`[data-testid="bar-layout-${key}"]`).dispatchEvent('click');
    await page.waitForTimeout(600);
    const confirm = page.locator('[data-testid="btn-confirm-template"]');
    for (let i = 0; i < 3 && (await confirm.isVisible().catch(() => false)); i++) {
      await confirm.click();
      await page.waitForTimeout(400);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    try {
      // Gate on a NEW render completing (not a stale ready flag).
      await expect.poll(async () => Number(await stage.getAttribute('data-render-seq') ?? 0)).toBeGreaterThan(before, { timeout: 8000 });
      return;
    } catch {
      // Swallowed interaction — retry the apply.
    }
  }
  await expect.poll(async () => Number(await stage.getAttribute('data-render-seq') ?? 0)).toBeGreaterThan(before, { timeout: 20000 });
}
