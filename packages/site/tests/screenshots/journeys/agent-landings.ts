/**
 * Agent landings journey — the markdown-powered hub and detail pages, plus a
 * localized variant.
 */
import { expect } from '@playwright/test'
import { waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/for'

export const agentLandingsJourney: JourneyDefinition = {
  key: 'agent-landings',
  title: 'Agent landings — hub, MCP steps, localized page',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/analytics-dashboard.md',
  preconditions: [
    'None — the pages are public markdown in the content layer.',
  ],
  notCovered: [
    'A live MCP connection — needs an OAuth app and a real client.',
  ],
  steps: [
    'agents-hub',
    'agent-chatgpt',
    'agent-localized',
  ],

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('agents-hub', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: /AI agents that post with MagicSync/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /ChatGPT/ }).first()).toBeVisible()
    })

    await journey.step('agent-chatgpt', async () => {
      await page.goto(`${baseURL}${ROUTE}/chatgpt`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: 'ChatGPT + MagicSync' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Connect ChatGPT in 60 seconds' })).toBeVisible()
      await expect(page.locator('#connect ol li')).toHaveCount(4)
      await expect(page.getByText('https://magicsync.dev/mcp').first()).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Prompts to try' })).toBeVisible()
      await expect(page.locator('#prompts ul li')).toHaveCount(4)
      await expect(page.getByRole('heading', { name: 'Other agents that post through MagicSync' })).toBeVisible()
      await expect(page.locator('#other-agents ul').first().locator('li')).toHaveCount(14)
    })

    await journey.step('agent-localized', async () => {
      await page.goto(`${baseURL}/es${ROUTE}/claude`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: 'Claude + MagicSync' })).toBeVisible()
    })
  },
}
