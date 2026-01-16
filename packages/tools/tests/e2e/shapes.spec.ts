import { test, expect } from '@playwright/test';

test.describe('Shape Tools', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        // Ensure we are on the Elements tab
        const elementsTab = page.locator('button:has(svg.lucide-shapes)'); // Based on Icon name="lucide:shapes"
        // Or tooltip text "Elements"
        await elementsTab.click();
    });

    test('should add a rectangle', async ({ page }) => {
        const canvas = page.locator('canvas.editor');

        // Click on Rect button
        await page.locator('button:has-text("Rect")').click();

        // Verify it's added to canvas (this is tricky via DOM as canvas is graphical)
        // But we can check the Layers tab or if the application has some side-effect accessible via DOM

        // Check Layers tab to verify object addition
        await page.locator('button:has(svg.lucide-layers)').click();
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
    });

    test('should add a circle', async ({ page }) => {
        await page.locator('button:has-text("Circle")').click();

        // Check Layers tab
        await page.locator('button:has(svg.lucide-layers)').click();
        await expect(page.locator('text=Circle').first()).toBeVisible();
    });

    test('should add a triangle', async ({ page }) => {
        await page.locator('button:has-text("Triangle")').click();

        // Check Layers tab
        await page.locator('button:has(svg.lucide-layers)').click();
        await expect(page.locator('text=Triangle').first()).toBeVisible();
    });
});
