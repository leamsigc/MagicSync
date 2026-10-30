/**
 * Media gallery journey — compact storage summary, masonry grid and the
 * carousel preview.
 */
import { expect } from '@playwright/test'
import { createTestAssets, waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/media'

export const mediaGalleryJourney: JourneyDefinition = {
  key: 'media-gallery',
  title: 'Media — storage summary, masonry grid and carousel preview',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/media-assets.md',
  preconditions: [
    'An active business with at least six image assets (fixture-written).',
  ],
  notCovered: [
    'Uploading a file — needs a real file picker and storage.',
    'Delete/optimize flows — destructive and covered by the API tests.',
  ],
  steps: [
    'media-storage',
    'media-masonry',
    'media-carousel',
    'media-carousel-next',
    'media-preview',
    'media-preview-next',
  ],

  async setup({ user, business }: JourneyContext) {
    await createTestAssets(user.id, business.id, 6)
  },

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('media-storage', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByText('Storage', { exact: true })).toBeVisible()
      await expect(page.getByText(/6 files/)).toBeVisible()
    })

    await journey.step('media-masonry', async () => {
      await expect(page.getByRole('button', { name: 'Masonry' })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.columns-1 > div').first()).toBeVisible()
    })

    await journey.step('media-carousel', async () => {
      await page.getByRole('button', { name: 'Carousel' }).click()
      await expect(page.getByText(/^1 \/ \d+$/).first()).toBeVisible()
      await page.getByText(/^1 \/ \d+$/).first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(400)
    })

    await journey.step('media-carousel-next', async () => {
      await page.getByRole('button', { name: /Next asset/ }).first().click()
      await expect(page.getByText(/^2 \/ \d+$/).first()).toBeVisible()
    })

    await journey.step('media-preview', async () => {
      await page.getByRole('button', { name: 'Masonry' }).click()
      await page.waitForTimeout(300)
      const first = page.locator('.columns-1 > div').first()
      await first.hover()
      await first.getByRole('button', { name: /Preview/ }).click()
      await expect(page.getByRole('button', { name: /Next asset/ })).toBeVisible()
      await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible()
    })

    await journey.step('media-preview-next', async () => {
      await page.getByRole('button', { name: /Next asset/ }).click()
      await expect(page.getByText(/^2 \/ \d+$/)).toBeVisible()
    })
  },
}
