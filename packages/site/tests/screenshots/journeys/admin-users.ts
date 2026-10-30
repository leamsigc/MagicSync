/**
 * Admin users journey — the shared table, key-based selection and the list view.
 *
 * Destructive bulk actions (ban/delete) are deliberately not driven; the
 * journey proves the surface and the selection contract without mutating users.
 */
import { expect } from '@playwright/test'
import { loginWith, promoteToAdmin, waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/admin/users'

export const adminUsersJourney: JourneyDefinition = {
  key: 'admin-users',
  title: 'Admin users — table, key-based selection and list view',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/analytics-dashboard.md',
  preconditions: [
    'An admin user (the fixture promotes itself in the dev DB).',
  ],
  notCovered: [
    'Ban / unban / delete / impersonate — destructive, needs a dedicated fixture user.',
    'Create user — covered by the server validation tests.',
  ],
  steps: [
    'admin-users-table',
    'admin-users-selection',
    'admin-users-list',
  ],

  async setup({ authed, user, page }: JourneyContext) {
    await promoteToAdmin(authed, user)
    await loginWith(page, user)
  },

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('admin-users-table', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Table' })).toBeVisible()
      await expect(page.locator('tbody tr').first()).toBeVisible()
    })

    await journey.step('admin-users-selection', async () => {
      await page.locator('tbody tr').first().getByRole('checkbox').click()
      await expect(page.getByText(/1 selected/)).toBeVisible()
    })

    await journey.step('admin-users-list', async () => {
      await page.getByRole('button', { name: 'List' }).click()
      await expect(page.getByPlaceholder(/Search users/i)).toBeVisible()
    })
  },
}
