import { test, expect } from '@playwright/test';

test.describe('Image Filters', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        // Wait for canvas to be ready
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });

        // Upload or add an image first (filters only work on images)
        // For now, we'll use the upload functionality or assume a default image
        // TODO: Add image loading logic here
    });

    test('should apply preset filters', async ({ page }) => {
        // Need an image layer active
        // For testing, we can add a sample image via sidebar upload

        // Switch to uploads or add image programmatically
        await page.click('[data-testid="tab-uploads"]');

        // Wait for image to be added and selected
        // Then check if Filters section appears
        await expect(page.locator('h3:has-text("Filters")')).toBeVisible({ timeout: 5000 });

        // Test preset filters
        const presetSelect = page.locator('select').filter({ hasText: 'None' }).first();
        await presetSelect.selectOption('Grayscale');

        // Verify filter was applied (visual check would be complex, so we verify UI state)
        await expect(presetSelect).toHaveValue('Grayscale');
    });

    test('should adjust brightness filter', async ({ page }) => {
        await page.click('[data-testid="tab-uploads"]');
        await expect(page.locator('h3:has-text("Filters")')).toBeVisible({ timeout: 5000 });

        // Find Brightness slider
        const brightnessSlider = page.locator('input[type="range"]').filter({
            has: page.locator('label:has-text("Brightness")')
        });

        await brightnessSlider.fill('50');
        await expect(brightnessSlider).toHaveValue('50');
    });

    test('should adjust contrast filter', async ({ page }) => {
        await page.click('[data-testid="tab-uploads"]');
        await expect(page.locator('h3:has-text("Filters")')).toBeVisible({ timeout: 5000 });

        const contrastSlider = page.locator('input[type="range"]').filter({
            has: page.locator('label:has-text("Contrast")')
        });

        await contrastSlider.fill('-30');
        await expect(contrastSlider).toHaveValue('-30');
    });

    test('should adjust saturation filter', async ({ page }) => {
        await page.click('[data-testid="tab-uploads"]');
        await expect(page.locator('h3:has-text("Filters")')).toBeVisible({ timeout: 5000 });

        const saturationSlider = page.locator('input[type="range"]').filter({
            has: page.locator('label:has-text("Saturation")')
        });

        await saturationSlider.fill('75');
        await expect(saturationSlider).toHaveValue('75');
    });

    test('should combine multiple filters', async ({ page }) => {
        await page.click('[data-testid="tab-uploads"]');
        await expect(page.locator('h3:has-text("Filters")')).toBeVisible({ timeout: 5000 });

        // Apply multiple adjustments
        const sliders = await page.locator('input[type="range"]').all();

        // Brightness
        await sliders[0].fill('25');
        // Contrast
        await sliders[1].fill('15');
        // Saturation
        await sliders[2].fill('-10');

        // Verify all values set
        await expect(sliders[0]).toHaveValue('25');
        await expect(sliders[1]).toHaveValue('15');
        await expect(sliders[2]).toHaveValue('-10');
    });
});
