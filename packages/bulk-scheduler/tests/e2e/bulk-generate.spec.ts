import { test, expect } from '@playwright/test'

test.describe('Bulk Generation Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/app/bulk-scheduler/generate')
    })

    test('should display bulk generation page', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Bulk Generate')
        await expect(page.locator('textarea')).toBeVisible()
    })

    test('should detect variables in template', async ({ page }) => {
        const template = 'Hello {{name}}, welcome to {{place}}!'
        await page.fill('textarea', template)

        await expect(page.locator('text=Detected variables')).toBeVisible()
        await expect(page.locator('text=name')).toBeVisible()
        await expect(page.locator('text=place')).toBeVisible()
    })

    test('should allow adding custom variables', async ({ page }) => {
        const addButton = page.locator('button:has-text("Add Variable")')
        await addButton.click()

        await expect(page.locator('input[placeholder="Variable name"]')).toBeVisible()
        await expect(page.locator('input[placeholder="Value"]')).toBeVisible()
    })

    test('should allow removing custom variables', async ({ page }) => {
        const addButton = page.locator('button:has-text("Add Variable")')
        await addButton.click()

        const removeButton = page.locator('button[title*="Remove"], button:has(svg)').last()
        await removeButton.click()

        await expect(page.locator('text=No custom variables')).toBeVisible()
    })

    test('should require all fields before generation', async ({ page }) => {
        const generateButton = page.locator('button:has-text("Generate Posts")')
        await expect(generateButton).toBeDisabled()
    })

    test('should enable generate button when all fields are filled', async ({ page }) => {
        await page.fill('input[placeholder*="business"]', 'test-business-123')
        await page.fill('textarea', 'Test template with {{variable}}')
        await page.fill('input[type="number"]', '2')

        await page.click('text=Facebook')

        const generateButton = page.locator('button:has-text("Generate Posts")')
        await expect(generateButton).toBeEnabled()
    })

    test('should show scheduling options', async ({ page }) => {
        await expect(page.locator('text=Skip weekends')).toBeVisible()
        await expect(page.locator('text=Business hours only')).toBeVisible()
    })

    test('should update posts per day value', async ({ page }) => {
        const input = page.locator('input[type="number"]')
        await input.fill('5')

        await expect(input).toHaveValue('5')
    })

    test('should show first comment field', async ({ page }) => {
        await expect(page.locator('input[placeholder*="first comment"]')).toBeVisible()
    })
})
