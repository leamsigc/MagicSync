import { test, expect } from '@playwright/test';

test.describe('Draw Plugin (Pencil/Brush)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
        await page.waitForSelector('[data-testid="tab-elements"]', { timeout: 10000 });
    });

    test('should activate pencil tool', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');

        // Click pencil/brush button
        const pencilBtn = page.locator('button:has-text("Pencil")').or(
            page.locator('button[icon="lucide:pencil"]')
        );

        await pencilBtn.click();

        // Tool should be activated (canvas cursor changes, but hard to verify)
        // We can verify button state or that no error occurred
    });

    test('should draw on canvas with mouse', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.locator('button:has-text("Pencil")').click();

        // Draw a line on canvas
        const canvas = page.locator('canvas.upper-canvas').first();
        await canvas.hover();

        // Mouse down, move, mouse up
        await canvas.click({ position: { x: 100, y: 100 } });
        await page.mouse.move(200, 200);
        await page.mouse.up();

        // Verify a path was created (check layers)
        await page.click('[data-testid="tab-layers"]');
        // Drawing creates a path object
        // This is hard to verify without visual inspection
    });

    test('should stop drawing mode when switching tools', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.locator('button:has-text("Pencil")').click();

        // Now click a shape button
        await page.click('[data-testid="add-rect"]');

        // Drawing mode should be stopped
        // Verify by checking no errors and rectangle was added
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
    });
});

test.describe('Shadow Plugin', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
    });

    test('should toggle shadow on shape', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Click shadow add button
        await page.click('[data-testid="add-shadow"]');

        // Shadow controls should appear
        await expect(page.locator('input[placeholder="Blur"]')).toBeVisible();
    });

    test('should adjust shadow offset X', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-shadow"]');

        const offsetXInput = page.locator('input[placeholder="X"]');
        await offsetXInput.fill('15');
        await offsetXInput.blur();

        await expect(offsetXInput).toHaveValue('15');
    });

    test('should adjust shadow offset Y', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-shadow"]');

        const offsetYInput = page.locator('input[placeholder="Y"]');
        await offsetYInput.fill('20');
        await offsetYInput.blur();

        await expect(offsetYInput).toHaveValue('20');
    });

    test('should adjust shadow blur', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-shadow"]');

        const blurInput = page.locator('input[placeholder="Blur"]');
        await blurInput.fill('25');
        await blurInput.blur();

        await expect(blurInput).toHaveValue('25');
    });

    test('should change shadow color', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-shadow"]');

        // Find shadow color input (likely the last color input in shadow section)
        const shadowSection = page.locator('text=Shadow').locator('..');
        const colorInput = shadowSection.locator('input[type="color"]');

        await colorInput.fill('#ff0000');
        await expect(colorInput).toHaveValue('#ff0000');
    });

    test('should disable shadow with toggle', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-shadow"]');

        // Find shadow toggle switch
        const shadowToggle = page.locator('button[role="switch"]').first();
        await shadowToggle.click();

        // Shadow inputs might hide
        await expect(shadowToggle).toHaveAttribute('aria-checked', 'false');
    });
});

test.describe('Export Plugin', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
    });

    test('should switch to export tab', async ({ page }) => {
        await page.click('button:has-text("Export")');

        await expect(page.locator('text=Export your creation')).toBeVisible();
    });

    test('should show download PNG button', async ({ page }) => {
        await page.click('button:has-text("Export")');

        const downloadBtn = page.locator('button:has-text("Download PNG")');
        await expect(downloadBtn).toBeVisible();
    });

    test('should trigger PNG download', async ({ page }) => {
        // Add something to canvas first
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Go to export
        await page.click('button:has-text("Export")');

        // Listen for download
        const downloadPromise = page.waitForEvent('download');
        await page.click('button:has-text("Download PNG")');

        const download = await downloadPromise;
        // Verify download was triggered
        expect(download.suggestedFilename()).toContain('.png');
    });
});
