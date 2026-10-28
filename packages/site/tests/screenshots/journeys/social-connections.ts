/**
 * Social connections journey — the integrations directory and the OAuth error
 * return path.
 *
 * Step IDs come from `.cursor/skills/verify-magicsync/features/social-connections.md`.
 * The error step is driven through the URL (`?error=<code>`) on purpose: the
 * real failure needs a live LinkedIn consent screen, while the point of the fix
 * is what the page does once the callback has already failed.
 */
import { expect } from '@playwright/test'
import { waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/integrations'

export const socialConnectionsJourney: JourneyDefinition = {
  key: 'social-connections',
  title: 'Social connections — provider directory and OAuth error return',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/social-connections.md',
  preconditions: [
    'A signed-in user (no connection required — the error state is a URL parameter).',
  ],
  notCovered: [
    'A real provider consent screen and its callback — needs live LinkedIn/Meta credentials and a human.',
    'Connecting a page from the picker — needs a provider account with pages.',
  ],
  steps: [
    'connections-directory',
    'connect-oauth-error',
  ],

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('connections-directory', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: /connect your social media accounts/i })).toBeVisible()
    })

    await journey.step('connect-oauth-error', async () => {
      await page.goto(`${baseURL}${ROUTE}?error=email_does_not_match`)
      await waitForHydration(page)
      // The Toaster also renders a visually hidden announcement (aria-live) with
      // the same text, so assert the VISIBLE toast — otherwise the capture can
      // race an announcement while the toast is still animating in.
      await expect(page.getByText(/different email/i).filter({ visible: true }).first()).toBeVisible()
    })
  },
}
