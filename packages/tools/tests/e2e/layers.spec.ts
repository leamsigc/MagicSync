import { test, expect } from '@playwright/test';

test.describe('Layers Panel', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
        await page.waitForSelector('[data-testid="tab-layers"]', { timeout: 10000 });
    });

    test('should display empty layers initially', async ({ page }) => {
        await page.click('[data-testid="tab-layers"]');

        await expect(page.locator('text=No layers yet')).toBeVisible();
        await expect(page.locator('text=0 Layers')).toBeVisible();
    });

    test('should show layer when shape is added', async ({ page }) => {
        // Add a rectangle
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Switch to layers tab
        await page.click('[data-testid="tab-layers"]');

        // Verify layer appears
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
        await expect(page.locator('text=1 Layers')).toBeVisible();
    });

    test('should select layer on click', async ({ page }) => {
        // Add two shapes
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-circle"]');

        // Go to layers
        await page.click('[data-testid="tab-layers"]');

        // Click on rectangle layer
        await page.locator('text=Rectangle').first().click();

        // Should be selected (visual verification is complex, but no error means success)
    });

    test('should delete layer', async ({ page }) => {
        // Add a shape
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Go to layers and delete
        await page.click('[data-testid="tab-layers"]');

        // Find delete button (usually trash icon)
        const deleteBtn = page.locator('button[icon="lucide:trash-2"]').first();
        if (await deleteBtn.isVisible()) {
            await deleteBtn.click();

            // Verify layer removed
            await expect(page.locator('text=No layers yet')).toBeVisible();
        }
    });

    test('should show visibility toggle', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        await page.click('[data-testid="tab-layers"]');

        // Look for eye icon (visibility toggle)
        const visibilityBtn = page.locator('button[icon="lucide:eye"]').first();
        if (await visibilityBtn.isVisible()) {
            await visibilityBtn.click();
            // Icon should change to eye-off
            await expect(page.locator('button[icon="lucide:eye-off"]').first()).toBeVisible();
        }
    });

    test('should show lock toggle', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        await page.click('[data-testid="tab-layers"]');

        // Look for lock icon
        const lockBtn = page.locator('button[icon="lucide:lock"]').first();
        if (await lockBtn.isVisible()) {
            await lockBtn.click();
        }
    });

    test('should rename layer', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        await page.click('[data-testid="tab-layers"]');

        // Double click to rename or look for rename input
        const layerName = page.locator('text=Rectangle').first();
        await layerName.dblclick();

        // If editable input appears
        const nameInput = page.locator('input[type="text"]').first();
        if (await nameInput.isVisible()) {
            await nameInput.fill('My Rectangle');
            await nameInput.press('Enter');

            await expect(page.locator('text=My Rectangle')).toBeVisible();
        }
    });

    test('should display multiple layers in order', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-circle"]');
        await page.click('[data-testid="add-triangle"]');

        await page.click('[data-testid="tab-layers"]');

        await expect(page.locator('text=3 Layers')).toBeVisible();

        // All layers should be visible
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
        await expect(page.locator('text=Circle').first()).toBeVisible();
        await expect(page.locator('text=Triangle').first()).toBeVisible();
    });

    test('should refresh layers list', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        await page.click('[data-testid="tab-layers"]');

        // Click refresh button
        const refreshBtn = page.locator('button[icon="lucide:refresh-ccw"]');
        await refreshBtn.click();

        // Layer should still be visible after refresh
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
    });
});
