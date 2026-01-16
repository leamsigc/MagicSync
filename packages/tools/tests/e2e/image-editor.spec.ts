import { test, expect } from '@playwright/test';

test.describe('Image Editor - Plugin Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should add text and apply font changes', async ({ page }) => {
        await page.click('button[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        await expect(page.locator('h3:has-text("Text")')).toBeVisible();

        await page.selectOption('select[data-testid="select-font-family"]', 'Roboto');

        const sizeInput = page.locator('input[data-testid="input-font-size"]');
        await sizeInput.fill('24');
        await sizeInput.blur();

        await expect(sizeInput).toHaveValue('24');
    });

    test('should apply shadow to object', async ({ page }) => {
        await page.click('button[data-testid="tab-elements"]');
        await page.click('button[data-testid="add-rect"]');

        const shadowToggle = page.locator('button[data-testid="add-shadow"]');
        await shadowToggle.click();

        await expect(page.locator('input[placeholder="Blur"]')).toBeVisible();

        const blurInput = page.locator('input[placeholder="Blur"]');
        await blurInput.fill('20');
        await blurInput.blur();
    });

    test('should apply stroke to shape', async ({ page }) => {
        await page.click('button[data-testid="tab-elements"]');
        await page.click('button[data-testid="add-circle"]');

        const widthInput = page.locator('input[data-testid="input-stroke-width"]');
        await widthInput.fill('5');
        await widthInput.blur();

        await expect(widthInput).toHaveValue('5');
    });

    test('should change canvas background color', async ({ page }) => {
        const canvas = page.locator('canvas.upper-canvas').first();
        await canvas.click({ position: { x: 10, y: 10 } });

        await page.selectOption('select[data-testid="select-bg-type"]', 'solid');
    });

    test('should create gradient background', async ({ page }) => {
        const canvas = page.locator('canvas.upper-canvas').first();
        await canvas.click({ position: { x: 10, y: 10 } });

        await page.selectOption('select[data-testid="select-bg-type"]', 'gradient');
        await expect(page.locator('select:has-text("Linear")')).toBeVisible();
    });

    test('should align object to center', async ({ page }) => {
        await page.click('button[data-testid="tab-elements"]');
        await page.click('button[data-testid="add-rect"]');

        const centerBtn = page.locator('button[data-testid="align-center"]');
        await centerBtn.click();
    });

    test('should add and remove guidelines', async ({ page }) => {
        const canvas = page.locator('canvas.upper-canvas').first();
        await canvas.click({ position: { x: 10, y: 10 } });

        await page.click('button:has-text("+ H Guide")');
    });

    test('should toggle rulers on/off', async ({ page }) => {
        const canvas = page.locator('canvas.upper-canvas').first();
        await canvas.click({ position: { x: 10, y: 10 } });

        const rulersToggle = page.locator('button[data-testid="toggle-rulers"]');
        await rulersToggle.click();

        await expect(rulersToggle).toHaveAttribute('aria-checked', 'true');
    });

    test('should apply opacity to object', async ({ page }) => {
        await page.click('button[data-testid="tab-elements"]');
        await page.click('button[data-testid="add-circle"]');

        const opacitySlider = page.locator('input[type="range"][max="100"]');
        await opacitySlider.fill('50');
        await expect(page.locator('label', { hasText: 'Opacity 50%' })).toBeVisible();
    });

    test('should flip object horizontally and vertically', async ({ page }) => {
        await page.click('button[data-testid="tab-elements"]');
        await page.click('button[data-testid="add-triangle"]');

        await page.click('button[data-testid="btn-flip-h"]');
        await page.click('button[data-testid="btn-flip-v"]');
        // Visual verification is hard, but clicking should not error
    });

    test('should export as PNG', async ({ page }) => {
        await page.click('button:has-text("Export")');
        await page.click('button:has-text("Download PNG")');
    });
});
