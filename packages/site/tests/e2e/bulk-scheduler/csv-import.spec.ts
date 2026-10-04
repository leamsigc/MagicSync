import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// papaparse is a dependency of @local-monorepo/bulk-scheduler, so resolve it
// from that package rather than adding it to this one.
const requireFromBulkScheduler = createRequire(
    join(dirname(fileURLToPath(import.meta.url)), '../../../../bulk-scheduler/package.json'),
)
import {
  createTestUser,
  createActiveBusiness,
  createTestAccount,
  loginWith,
  waitForHydration,
  type TestUser,
  type TestBusiness,
} from '../helpers/e2e-utils'

// The fixtures live beside this spec, not one directory up: `../fixtures`
// pointed at packages/site/tests/e2e/fixtures, which does not exist.
const fixturesDir = dirname(fileURLToPath(import.meta.url)) + '/fixtures'

// Derive the expected row count from the fixture with the same parser the app
// uses. Counting physical lines is wrong: the content column holds quoted
// multi-line fields, so 117 lines are only 39 records.
function sampleRowCount(): number {
    const Papa = requireFromBulkScheduler('papaparse')
    const raw = readFileSync(join(fixturesDir, 'sample.csv'), 'utf8')
    return Papa.parse(raw.trim(), { header: true, skipEmptyLines: true }).data.length
}

/**
 * `/app/**` is gated server-side by `01.auth.global.ts`, so the page must be
 * visited with a real Better Auth session (browser-level mocks never reach SSR).
 *
 * Assertions mirror the real CSV import flow:
 * step 1 "Add Posts" (upload) → step 2 "Preview & Edit" (table + scheduling
 * settings) → "Import & Schedule" (requires business + platform selection).
 */
let user: TestUser
let business: TestBusiness

test.beforeAll(async ({ request }) => {
    test.setTimeout(120000)
    user = await createTestUser(request)
    business = await createActiveBusiness(request, user)
    await createTestAccount(user.id, business.id)
})

test.describe('CSV Import Flow', () => {
    test.beforeEach(async ({ page }) => {
        await loginWith(page, user)
        await page.goto('/app/bulk-scheduler/csv-import')
        await waitForHydration(page)
    })

    test('should display CSV import page', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('CSV Import')
        await expect(page.getByRole('heading', { name: 'Upload CSV File' })).toBeVisible()
    })

    test('should accept CSV file upload', async ({ page }) => {
        await page.locator('input[type="file"]').setInputFiles(join(fixturesDir, 'sample.csv'))

        await expect(page.getByRole('heading', { name: 'Preview & Edit' })).toBeVisible()
        await expect(page.getByText(`${sampleRowCount()} posts`)).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Scheduling Settings' })).toBeVisible()
    })

    test('should show validation errors for invalid file type', async ({ page }) => {
        let dialogMessage = ''
        page.on('dialog', async dialog => {
            dialogMessage = dialog.message()
            await dialog.accept()
        })

        await page.locator('input[type="file"]').setInputFiles(join(fixturesDir, 'invalid.txt'))

        await expect.poll(() => dialogMessage, { timeout: 5000 }).toContain('CSV')
        // Invalid file must not advance past the upload step
        await expect(page.getByRole('heading', { name: 'Preview & Edit' })).toHaveCount(0)
    })

    test('should proceed to scheduling settings after file upload', async ({ page }) => {
        await page.locator('input[type="file"]').setInputFiles(join(fixturesDir, 'sample.csv'))

        await expect(page.getByRole('heading', { name: 'Scheduling Settings' })).toBeVisible()
    })

    test('should require business ID and platforms', async ({ page }) => {
        await page.locator('input[type="file"]').setInputFiles(join(fixturesDir, 'sample.csv'))

        // Business auto-selects via the business-check middleware, but no
        // platform is picked yet → import stays disabled
        const importButton = page.getByRole('button', { name: 'Import & Schedule' })
        await expect(importButton).toBeDisabled()
    })

    test('should enable import button when all required fields are filled', async ({ page }) => {
        await page.locator('input[type="file"]').setInputFiles(join(fixturesDir, 'sample.csv'))
        await expect(page.getByRole('heading', { name: 'Preview & Edit' })).toBeVisible()

        // Select the connected test account chip (PlatformSelector)
        await page.locator('div.cursor-pointer.w-12.h-12').first().click()

        const importButton = page.getByRole('button', { name: 'Import & Schedule' })
        await expect(importButton).toBeEnabled()
    })

    test('should show date range selector when distribute evenly is checked', async ({ page }) => {
        await page.locator('input[type="file"]').setInputFiles(join(fixturesDir, 'sample.csv'))
        await expect(page.getByRole('heading', { name: 'Preview & Edit' })).toBeVisible()

        // UCheckbox renders a hidden proxy input, so target it by its
        // accessible name, which is the translated label.
        await page.getByLabel('Distribute posts evenly across date range').check()

        await expect(page.getByText('Date Range', { exact: true })).toBeVisible()
    })
})
