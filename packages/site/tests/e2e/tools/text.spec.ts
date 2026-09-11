import { test, expect } from '@playwright/test';

test.describe('Text and Font Plugin', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
        await page.waitForSelector('[data-testid="tab-text"]', { timeout: 10000 });
    });

    test('should add heading text', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        // Verify text properties panel appears
        await expect(page.locator('h3:has-text("Text")')).toBeVisible();
    });

    test('should add body text', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a subheading")');

        await expect(page.locator('h3:has-text("Text")')).toBeVisible();
    });

    test('should change font family', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        const fontSelect = page.locator('[data-testid="select-font-family"]');
        await fontSelect.selectOption('Roboto');

        await expect(fontSelect).toHaveValue('Roboto');
    });

    test('should change font size', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        const sizeInput = page.locator('[data-testid="input-font-size"]');
        await sizeInput.fill('48');
        await sizeInput.blur();

        await expect(sizeInput).toHaveValue('48');
    });

    test('should apply bold formatting', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        const boldBtn = page.locator('[data-testid="btn-bold"]');
        await boldBtn.click();

        // Verify button is in active state
        await expect(boldBtn).toHaveAttribute('variant', 'solid');
    });

    test('should apply italic formatting', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        const italicBtn = page.locator('[data-testid="btn-italic"]');
        await italicBtn.click();

        await expect(italicBtn).toHaveAttribute('variant', 'solid');
    });

    test('should apply underline formatting', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        const underlineBtn = page.locator('[data-testid="btn-underline"]');
        await underlineBtn.click();

        await expect(underlineBtn).toHaveAttribute('variant', 'solid');
    });

    test('should change text alignment', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        // Click center alignment
        const centerAlignBtn = page.locator('button[icon="lucide:align-center"]').first();
        await centerAlignBtn.click();

        await expect(centerAlignBtn).toHaveAttribute('variant', 'solid');
    });

    test('should change text color', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        // Find color input in text section (not fill section)
        const textColorInput = page.locator('input[type="color"]').first();
        await textColorInput.fill('#00ff00');

        await expect(textColorInput).toHaveValue('#00ff00');
    });

    test('should apply multiple text styles', async ({ page }) => {
        await page.click('[data-testid="tab-text"]');
        await page.click('button:has-text("Add a heading")');

        // Change font
        await page.locator('[data-testid="select-font-family"]').selectOption('Helvetica');

        // Change size
        await page.locator('[data-testid="input-font-size"]').fill('36');

        // Apply bold and italic
        await page.click('[data-testid="btn-bold"]');
        await page.click('[data-testid="btn-italic"]');

        // Verify all applied
        await expect(page.locator('[data-testid="select-font-family"]')).toHaveValue('Helvetica');
        await expect(page.locator('[data-testid="input-font-size"]')).toHaveValue('36');
    });
});
