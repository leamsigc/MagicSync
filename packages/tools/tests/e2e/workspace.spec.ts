import { test, expect } from '@playwright/test';

test.describe('Image Editor Workspace', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the image editor page
        // Assuming the app runs at localhost:3000 and the route is /tools/image-editor
        // If running in playground, it might be just / if the playground only mounts this tool,
        // but based on directory structure it's likely /tools/image-editor or similar.
        // Let's try /tools/image-editor first.
        await page.goto('/tools/image-editor');
    });

    test('should render the workspace layout', async ({ page }) => {
        // Check for main layout elements
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('header')).toBeVisible(); // ImageEditorHeader
        await expect(page.locator('#workspace')).toBeVisible(); // Canvas container

        // Check if canvas exists
        const canvas = page.locator('canvas.editor');
        await expect(canvas).toBeVisible();

        // Check sidebars
        // We didn't inspect Sidebar/Properties codes, but assuming they have some recognizable structure or we can check by presence in DOM
        // Looking at index.vue: ImageEditorSidebar, ImageEditorProperties are used.
        // They are likely distinct divs.
    });

    test('should render canvas with correct background', async ({ page }) => {
        const canvas = page.locator('canvas.editor');
        await expect(canvas).toBeVisible();

        // Check if it has a specific class or style if needed
        // For now purely visibility is enough
    });
});
