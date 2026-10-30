/**
 * Business directory journey — the three collection views and the toolbar.
 *
 * Step IDs come from `.cursor/skills/verify-magicsync/features/business-onboarding.md`.
 * Create/edit/delete stay in the `business-create` journey; this one proves the
 * shared grid/list/table shell and the search box.
 */
import { expect } from '@playwright/test'
import { waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/business'
const SEARCH = 'E2E Business'

export const businessDirectoryJourney: JourneyDefinition = {
  key: 'business-directory',
  title: 'Business directory — grid, list, table and search on the shared collection shell',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/business-onboarding.md',
  preconditions: [
    'A signed-in user with at least one active business (the fixture creates one).',
  ],
  notCovered: [
    'Create / edit / delete — covered by the business-create journey.',
    'The onboarding wizard — needs a user with zero businesses.',
  ],
  steps: [
    'business-grid',
    'business-search',
    'business-list',
    'business-table',
  ],

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('business-grid', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: 'Business Management' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Grid' })).toBeVisible()
    })

    await journey.step('business-search', async () => {
      await page.getByPlaceholder('Search businesses').fill(SEARCH)
      await expect(page.getByText(SEARCH, { exact: true }).first()).toBeVisible()
    })

    await journey.step('business-list', async () => {
      await page.getByRole('button', { name: 'List' }).click()
      await expect(page.getByText(SEARCH, { exact: true }).first()).toBeVisible()
    })

    await journey.step('business-table', async () => {
      await page.getByRole('button', { name: 'Table' }).click()
      await expect(page.locator('th').filter({ hasText: 'Business' }).first()).toBeVisible()
      await expect(page.getByText(SEARCH, { exact: true }).first()).toBeVisible()
    })
  },
}
