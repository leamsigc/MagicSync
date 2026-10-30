/**
 * Admin businesses journey — the directory views on the admin surface.
 * Read-only: create/edit/delete live in the admin CRUD flows.
 */
import { expect } from '@playwright/test'
import { loginWith, promoteToAdmin, waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/admin/businesses'

export const adminBusinessesJourney: JourneyDefinition = {
  key: 'admin-businesses',
  title: 'Admin businesses — grid, list and table on the shared collection shell',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/analytics-dashboard.md',
  preconditions: [
    'An admin user (promoted by the fixture in the dev DB).',
    'At least one business exists.',
  ],
  notCovered: [
    'Edit / delete business — covered by the admin CRUD endpoints.',
  ],
  steps: [
    'admin-businesses-grid',
    'admin-businesses-list',
    'admin-businesses-table',
  ],

  async setup({ authed, user, page }: JourneyContext) {
    await promoteToAdmin(authed, user)
    await loginWith(page, user)
  },

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('admin-businesses-grid', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Grid' })).toBeVisible()
    })

    await journey.step('admin-businesses-list', async () => {
      await page.getByRole('button', { name: 'List' }).click()
      await expect(page.getByPlaceholder(/Search businesses/i)).toBeVisible()
    })

    await journey.step('admin-businesses-table', async () => {
      await page.getByRole('button', { name: 'Table' }).click()
      await expect(page.locator('th').filter({ hasText: /Business/i }).first()).toBeVisible()
    })
  },
}
