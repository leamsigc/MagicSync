/**
 * Dashboard trend journey — the restyled area chart with real 30-day metrics.
 * Without seeded history the chart hides itself, so the fixture writes metrics.
 */
import { expect } from '@playwright/test'
import { createAccountMetrics, waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app'

export const dashboardTrendJourney: JourneyDefinition = {
  key: 'dashboard-trend',
  title: 'Dashboard — 30-day trend chart in the MagicSync palette',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/analytics-dashboard.md',
  preconditions: [
    'An active business with 30 days of account metrics (fixture-written).',
  ],
  notCovered: [
    'Collecting fresh platform stats — needs live platform tokens.',
  ],
  steps: [
    'dashboard-trend-chart',
  ],

  async setup({ user, business }: JourneyContext) {
    await createAccountMetrics(user.id, business.id, 30)
  },

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('dashboard-trend-chart', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await page.waitForTimeout(1500)
      const chart = page.locator('canvas').first()
      await chart.scrollIntoViewIfNeeded()
      await expect(chart).toBeVisible()
      await expect(page.getByText('Last 30 Days').first()).toBeVisible()
    })
  },
}
