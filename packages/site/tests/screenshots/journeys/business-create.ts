/**
 * Business create journey — the Add Business wizard, driven end to end.
 *
 * Step IDs come from `.cursor/skills/verify-magicsync/features/business-onboarding.md`.
 * The wizard is also the flow that broke hardest on a phone (a 1024px
 * `min-width` made it unreachable, and `col-span-2` in a one-column grid crushed
 * every field), so running this at `SCREENSHOT_VIEWPORT=mobile` is the mobile
 * regression check for the whole business directory.
 *
 * The fixtures already give the user one active business, so this drives the
 * "second business" path: the same wizard, opened from `/app/business`.
 */
import { expect } from '@playwright/test'
import { waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/business'

export const businessCreateJourney: JourneyDefinition = {
  key: 'business-create',
  title: 'Business create — the Add Business wizard, step by step',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/business-onboarding.md',
  preconditions: [
    'A signed-in user with an active business (the wizard is opened from the directory).',
  ],
  notCovered: [
    'AI profile extraction — needs provider keys; the manual form is the same component tree.',
    'Step-zero follow/star prompts — that panel only renders on the gated /app/business/initial route.',
  ],
  steps: [
    'onboard-open',
    'onboard-step1-skip',
    'onboard-form',
    'onboard-form-company',
    'onboard-form-brand',
    'onboard-save',
  ],

  async run({ page, baseURL, journey }: JourneyContext) {
    const run = `e2e-${Date.now()}`
    const name = `Mobile Business ${run}`

    await page.goto(`${baseURL}${ROUTE}`)
    await waitForHydration(page)

    await journey.step('onboard-open', async () => {
      await page.getByRole('button', { name: /new business/i }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Create New Project')).toBeVisible()
    })

    await journey.step('onboard-step1-skip', async () => {
      await page.getByRole('button', { name: /skip ai extraction/i }).click()
      await expect(page.getByText('Business Details')).toBeVisible()
    })

    const field = (label: string) => page.getByLabel(label, { exact: false }).first()

    await journey.step('onboard-form', async () => {
      await page.getByPlaceholder('Enter business description').first().fill(`${name} description`)
      await field('Business Name').fill(name)
      await field('Phone').fill('+1 555 0100')
      await field('Address').fill('1 Mobile Street, Testville')
      await field('Website').fill(`https://${run}.example.com`)
      await field('Category').fill('Technology')
    })

    await journey.step('onboard-form-company', async () => {
      await page.getByText('Company Info', { exact: true }).first().click()
      await expect(page.getByText('Company Info', { exact: true }).first()).toBeVisible()
    })

    await journey.step('onboard-form-brand', async () => {
      await page.getByText('Brand Identity', { exact: true }).first().click()
    })

    await journey.step('onboard-save', async () => {
      await page.getByText('Business Details', { exact: true }).first().click()
      await page.getByRole('button', { name: /save business/i }).click()
      // Saving closes the wizard and navigates away from the directory.
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15000 })
      await page.waitForURL((url) => !url.pathname.endsWith(ROUTE), { timeout: 15000 })
    })
  },
}
