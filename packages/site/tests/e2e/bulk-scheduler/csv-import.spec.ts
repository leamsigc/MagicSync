import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

test.describe('CSV Import Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/app/bulk-scheduler/csv-import')
    })

    test('should display CSV import page', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('CSV Import')
        await expect(page.locator('.embla__container')).toBeVisible()
    })

    test('should accept CSV file upload', async ({ page }) => {
        const csvPath = join(__dirname, '../fixtures/sample.csv')

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(csvPath)

        await expect(page.locator('text=sample.csv')).toBeVisible()
    })

    test('should show validation errors for invalid file type', async ({ page }) => {
        const txtPath = join(__dirname, '../fixtures/invalid.txt')

        page.on('dialog', async dialog => {
            expect(dialog.message()).toContain('CSV')
            await dialog.accept()
        })

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(txtPath)
    })

    test('should proceed to configuration step after file upload', async ({ page }) => {
        const csvPath = join(__dirname, '../fixtures/sample.csv')

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(csvPath)

        await expect(page.locator('text=Configure Settings')).toBeVisible()
    })

    test('should require business ID and platforms', async ({ page }) => {
        const csvPath = join(__dirname, '../fixtures/sample.csv')

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(csvPath)

        const importButton = page.locator('button:has-text("Import")')
        await expect(importButton).toBeDisabled()
    })

    test('should enable import button when all required fields are filled', async ({ page }) => {
        const csvPath = join(__dirname, '../fixtures/sample.csv')

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(csvPath)

        await page.fill('input[placeholder*="business"]', 'test-business-123')

        await page.click('text=Facebook')

        const importButton = page.locator('button:has-text("Import")')
        await expect(importButton).toBeEnabled()
    })

    test('should show date range selector when distribute evenly is checked', async ({ page }) => {
        const csvPath = join(__dirname, '../fixtures/sample.csv')

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(csvPath)

        const checkbox = page.locator('input[type="checkbox"]')
        await checkbox.check()

        await expect(page.locator('text=Distribution Date Range')).toBeVisible()
    })
})
