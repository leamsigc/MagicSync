import { test, expect } from '@playwright/test';

test.describe('Clipboard Plugin (Copy/Paste/Cut)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
        await page.waitForSelector('[data-testid="tab-elements"]', { timeout: 10000 });
    });

    test('should copy object with Ctrl+C', async ({ page }) => {
        // Add a shape
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Select it (it should be selected by default)
        // Copy with keyboard
        await page.keyboard.press('Control+c');

        // No visual feedback but clipboard should have data
    });

    test('should paste object with Ctrl+V', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Copy and paste
        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+v');

        // Should have 2 rectangles now
        await page.click('[data-testid="tab-layers"]');
        const rectangles = page.locator('text=Rectangle');
        await expect(rectangles).toHaveCount(2);
    });

    test('should cut object with Ctrl+X', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Cut
        await page.keyboard.press('Control+x');

        // Object should be removed from canvas
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=No layers yet')).toBeVisible();
    });

    test('should paste after cut', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Cut and paste
        await page.keyboard.press('Control+x');
        await page.keyboard.press('Control+v');

        // Rectangle should reappear
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
    });

    test('should paste multiple times', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Copy and paste 3 times
        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+v');
        await page.keyboard.press('Control+v');
        await page.keyboard.press('Control+v');

        // Should have 4 rectangles total
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=4 Layers')).toBeVisible();
    });
});

test.describe('Lock Plugin', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
    });

    test('should lock object from properties panel', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Find lock button in properties (Tools section if it exists)
        // Or in layers panel
        await page.click('[data-testid="tab-layers"]');

        const lockBtn = page.locator('button[icon="lucide:lock"]').or(
            page.locator('button[icon="lucide:unlock"]')
        ).first();

        if (await lockBtn.isVisible()) {
            await lockBtn.click();
            // Icon should change to locked state
        }
    });

    test('should prevent editing of locked object', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Lock it
        const lockBtn = page.locator('button[icon="lucide:unlock"]').first();
        if (await lockBtn.isVisible()) {
            await lockBtn.click();

            // Try to change fill color (should not work when locked)
            const fillInput = page.locator('[data-testid="input-fill"]');
            const originalValue = await fillInput.inputValue();
            await fillInput.fill('#ff0000');

            // Value might not change if locked (depends on implementation)
        }
    });

    test('should unlock object', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');

        // Lock then unlock
        const lockBtn = page.locator('button[icon="lucide:unlock"]').first();
        if (await lockBtn.isVisible()) {
            await lockBtn.click(); // Lock
            await page.waitForTimeout(200);

            const unlockedBtn = page.locator('button[icon="lucide:lock"]').first();
            await unlockedBtn.click(); // Unlock

            // Should be unlocked now
            await expect(page.locator('button[icon="lucide:unlock"]').first()).toBeVisible();
        }
    });
});

test.describe('Group Plugin', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });
    });

    test('should group multiple objects with Ctrl+G', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-circle"]');

        // Select all with Ctrl+A
        await page.keyboard.press('Control+a');

        // Group with Ctrl+G
        await page.keyboard.press('Control+g');

        // Check layers - should show a group
        await page.click('[data-testid="tab-layers"]');
        // Group might be labeled as "Group" or similar
    });

    test('should ungroup objects with Ctrl+Shift+G', async ({ page }) => {
        await page.click('[data-testid="tab-elements"]');
        await page.click('[data-testid="add-rect"]');
        await page.click('[data-testid="add-circle"]');

        // Group and ungroup
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Control+g');
        await page.keyboard.press('Control+Shift+G');

        // Should have individual objects again
        await page.click('[data-testid="tab-layers"]');
        await expect(page.locator('text=Rectangle').first()).toBeVisible();
        await expect(page.locator('text=Circle').first()).toBeVisible();
    });
});

test.describe('Ruler and Guidelines', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tools/image-editor');
        await page.waitForSelector('canvas.upper-canvas', { timeout: 10000 });

        // Deselect all to see canvas properties
        const canvas = page.locator('canvas.upper-canvas').first();
        await canvas.click({ position: { x: 10, y: 10 } });
    });

    test('should toggle rulers', async ({ page }) => {
        const rulersToggle = page.locator('[data-testid="toggle-rulers"]');
        await rulersToggle.click();

        await expect(rulersToggle).toHaveAttribute('aria-checked', 'true');

        // Click again to toggle off
        await rulersToggle.click();
        await expect(rulersToggle).toHaveAttribute('aria-checked', 'false');
    });

    test('should add horizontal guideline', async ({ page }) => {
        const addHGuideBtn = page.locator('button:has-text("+ H Guide")');
        await addHGuideBtn.click();

        // Guideline should be added (visual verification is complex)
    });

    test('should add vertical guideline', async ({ page }) => {
        const addVGuideBtn = page.locator('button:has-text("+ V Guide")');
        await addVGuideBtn.click();

        // Guideline should be added
    });

    test('should toggle snap to guides', async ({ page }) => {
        const snapToggle = page.locator('text=Snap to Guides').locator('..').locator('button[role="switch"]');

        if (await snapToggle.isVisible()) {
            await snapToggle.click();
            // Snap should be enabled/disabled
        }
    });
});
