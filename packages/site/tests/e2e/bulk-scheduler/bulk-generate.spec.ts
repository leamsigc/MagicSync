import { test, expect } from '@playwright/test'
import {
  createTestUser,
  createActiveBusiness,
  createTestAccount,
  loginWith,
  waitForHydration,
  type TestUser,
  type TestBusiness,
} from '../helpers/e2e-utils'

/**
 * `/app/**` is gated server-side by `01.auth.global.ts`, so the page must be
 * visited with a real Better Auth session (browser-level mocks never reach SSR).
 *
 * Assertions mirror the real Bulk Generate UI: template editor with system
 * variables, custom variable modal (New Variable / Add First Variable),
 * content rows, and the Generate Posts button gated on template + business +
 * platform + row.
 */
let user: TestUser
let business: TestBusiness

test.beforeAll(async ({ request }) => {
    test.setTimeout(120000)
    user = await createTestUser(request)
    business = await createActiveBusiness(request, user)
    await createTestAccount(user.id, business.id)
})

/** Adds a custom variable named `name` through the variable modal. */
async function addCustomVariable(page: import('@playwright/test').Page, name: string, label: string) {
    const emptyStateButton = page.getByRole('button', { name: 'Add First Variable' })
    const newVariableButton = page.getByRole('button', { name: 'New Variable' })
    if (await emptyStateButton.isVisible().catch(() => false)) {
        await emptyStateButton.click()
    } else {
        await newVariableButton.click()
    }

    await page.getByPlaceholder('e.g. coffee_flavor').fill(name)
    await page.getByPlaceholder('e.g. Coffee Flavor').fill(label)
    await page.getByRole('button', { name: 'Add Custom Variable' }).click()
}

/** Selects the connected test account chip in the PlatformSelector. */
async function selectPlatform(page: import('@playwright/test').Page) {
    await page.locator('div.cursor-pointer.w-12.h-12').first().click()
}

test.describe('Bulk Generation Flow', () => {
    test.beforeEach(async ({ page }) => {
        await loginWith(page, user)
        await page.goto('/app/bulk-scheduler/generate')
        await waitForHydration(page)
    })

    test('should display bulk generation page', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Bulk Generate')
        await expect(page.locator('textarea').first()).toBeVisible()
    })

    test('should expose system variables and template hint for the template', async ({ page }) => {
        const template = 'Hello {{name}}, welcome to {{place}}!'
        await page.locator('textarea').first().fill(template)

        await expect(page.getByText('System Variables')).toBeVisible()
        await expect(page.getByText('Use double curly braces for variables')).toBeVisible()
    })

    test('should allow adding custom variables', async ({ page }) => {
        await expect(page.getByText('No custom variables defined')).toBeVisible()

        await addCustomVariable(page, 'name', 'Name')

        await expect(page.getByText('No custom variables defined')).toHaveCount(0)
        await expect(page.getByText('Click to insert placeholder:')).toBeVisible()
        await expect(page.getByText('Name', { exact: true }).first()).toBeVisible()
    })

    test('should allow removing custom variables', async ({ page }) => {
        await addCustomVariable(page, 'name', 'Name')
        await expect(page.getByText('No custom variables defined')).toHaveCount(0)

        // Variable rows only render a trash button while variables exist
        await page.locator('button:has([class*="trash"])').first().click()

        await expect(page.getByText('No custom variables defined')).toBeVisible()
    })

    test('should require all fields before generation', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Generate Posts' })).toBeDisabled()
    })

    test('should enable generate button when all fields are filled', async ({ page }) => {
        await page.locator('textarea').first().fill('Test template with {{variable}}')
        await addCustomVariable(page, 'variable', 'Variable')
        await selectPlatform(page)

        // Content rows require a custom variable first (row modal gate)
        const addRow = page.getByRole('button', { name: 'Add First Row' })
        if (await addRow.isVisible().catch(() => false)) {
            await addRow.click()
        } else {
            await page.getByRole('button', { name: 'Add Row', exact: true }).first().click()
        }
        await page.getByPlaceholder('Enter value for Variable...').fill('Row value')
        // Modal is teleported to the end of <body>, after the header's Add Row button
        await page.getByRole('button', { name: 'Add Row', exact: true }).last().click()

        await expect(page.getByRole('button', { name: 'Generate Posts' })).toBeEnabled()
        await expect(page.getByText(/\b1 items\b/)).toBeVisible()
    })

    test('should show scheduling options', async ({ page }) => {
        await expect(page.getByText('Skip weekends')).toBeVisible()
        await expect(page.getByText('Business hours only')).toBeVisible()
    })

    test('should show ready-to-post counter', async ({ page }) => {
        await expect(page.getByText('Ready to post:')).toBeVisible()
        await expect(page.getByText(/\b0 items\b/)).toBeVisible()
    })

    test('should show first comment field', async ({ page }) => {
        await expect(page.getByPlaceholder('Template for the first comment on each post')).toBeVisible()
    })
})
