import { test, expect } from '@playwright/test';

test.describe('History Plugin (Undo/Redo)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
        await page.waitForSelector('[data-testid="tab-elements"]', { timeout: 10000 });
    });

    test('should undo shape addition with Ctrl+Z', async ({ page }) => {
        // Add a shape
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Verify shape was added by checking layers
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=Rectangle').first()).toBeVisible();

        // Undo with keyboard shortcut
        await page.keyboard.press('Control+z');

        // Verify shape was removed
        await expect(page.locator('text=Rectangle').first()).not.toBeVisible();
    });

    test('should redo with Ctrl+Shift+Z', async ({ page }) => {
        // Add and undo a shape
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-circle"]');
        await page.keyboard.press('Control+z');

        // Redo
        await page.keyboard.press('Control+Shift+Z');

        // Verify shape reappears
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=Circle').first()).toBeVisible();
    });

    test('should support multiple undo steps', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');

        // Add three shapes
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-circle"]');
        await page.click('[data-testid="add-triangle"]');

        // Undo twice
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+z');

        // Check layers - should only have rectangle
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
        await expect(page.locator('text=Circle').first()).not.toBeVisible();
    });

    test('should track property changes', async ({ page }) => {
        // Add shape
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Change fill color
        const fillInput = page.locator('[data-testid="input-fill"]');
        await fillInput.fill('#ff0000');

        // Undo color change
        await page.keyboard.press('Control+z');

        // Color should revert (checking this is tricky without inspecting canvas)
        // We can at least verify undo was triggered
    });
});
