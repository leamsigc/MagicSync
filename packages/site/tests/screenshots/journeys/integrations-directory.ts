/**
 * Integrations directory journey — the shared collection shell on the provider
 * list. The fixture user has no social connections, so the run proves the three
 * views plus the empty state (and that switching views never loses the toolbar).
 */
import { expect } from '@playwright/test'
import { waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/integrations'

export const integrationsDirectoryJourney: JourneyDefinition = {
  key: 'integrations-directory',
  title: 'Integrations directory — grid, list and table for providers',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/social-connections.md',
  preconditions: [
    'A signed-in user with an active business.',
    'No social connection required — the empty state is part of the evidence.',
  ],
  notCovered: [
    'A real OAuth consent flow — needs live provider credentials.',
  ],
  steps: [
    'integrations-grid',
    'integrations-list',
    'integrations-table',
  ],

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('integrations-grid', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: /Connect your social media accounts/i })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Grid' })).toBeVisible()
    })

    await journey.step('integrations-list', async () => {
      await page.getByRole('button', { name: 'List' }).click()
      await expect(page.getByPlaceholder('Search providers')).toBeVisible()
    })

    await journey.step('integrations-table', async () => {
      await page.getByRole('button', { name: 'Table' }).click()
      await expect(page.getByPlaceholder('Search providers')).toBeVisible()
    })
  },
}
