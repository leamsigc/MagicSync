/**
 * Design-studio journey — the editor rail, the studio panels and the bulk
 * generator. Each step proves one panel actually mounts and carries its
 * primary controls; destructive actions (save/publish/delete) are not driven.
 */
import { expect } from '@playwright/test'
import { loginWith, waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/tools/image-editor'

export const imageEditorStudioJourney: JourneyDefinition = {
  key: 'image-editor-studio',
  title: 'Design studio — rail panels and batch generator',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/image-editor.md',
  preconditions: [
    'A signed-in user.',
    'Editor plugins registered (Studio, Animation, Resize).',
  ],
  notCovered: [
    'Save / publish / delete / restore — mutate stored designs, kept for manual QA.',
    'Server render, batch generation and MP4 export — API-level behaviour.',
    'Canvas drag/resize gestures — fabric internals, no stable DOM handle.',
  ],
  steps: [
    'editor-studio-rail',
    'editor-studio-templates',
    'editor-studio-variables',
    'editor-studio-stock',
    'editor-studio-background',
    'editor-studio-fonts',
    'editor-studio-timeline',
    'editor-studio-resize',
    'editor-studio-rulers',
    'editor-studio-designs',
    'editor-studio-timeline-strip',
    'editor-studio-bulk',
  ],

  async setup({ page, user }: JourneyContext) {
    await loginWith(page, user)
  },

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('editor-studio-rail', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByTestId('btn-open-bulk')).toBeVisible()
      await expect(page.getByTestId('tab-variables')).toBeVisible()
      await expect(page.getByTestId('tab-designs')).toBeVisible()
    })

    await journey.step('editor-studio-templates', async () => {
      await page.getByTestId('tab-templates').click()
      await expect(page.getByRole('heading', { name: 'Layers' })).toBeHidden()
      await expect(page.getByText(/Import JSON template/i)).toBeVisible()
    })

    await journey.step('editor-studio-variables', async () => {
      await page.getByTestId('tab-variables').click()
      await expect(page.getByText(/variables/i).first()).toBeVisible()
    })

    await journey.step('editor-studio-stock', async () => {
      await page.getByTestId('tab-stock').click()
      await expect(page.getByPlaceholder(/Search stock/i)).toBeVisible()
    })

    await journey.step('editor-studio-background', async () => {
      await page.getByTestId('tab-background').click()
      await expect(page.locator('aside h2').filter({ hasText: 'Background' })).toBeVisible()
      await expect(page.getByText(/Photo by/i).first()).toBeVisible()
      await page.locator('aside button[aria-label="Gradient"]').first().click()
      await expect(page.getByText(/Background applied/i).first()).toBeVisible()
    })

    await journey.step('editor-studio-fonts', async () => {
      await page.getByTestId('tab-fonts').click()
      await expect(page.getByText(/Font pairs/i)).toBeVisible()
    })

    await journey.step('editor-studio-timeline', async () => {
      await page.getByTestId('tab-timeline').click()
      await expect(page.getByRole('button', { name: /Export MP4/i })).toBeVisible()
    })

    await journey.step('editor-studio-resize', async () => {
      await page.getByTestId('tab-resize').click()
      await expect(page.getByTestId('resize-entry').first()).toBeVisible()
    })

    await journey.step('editor-studio-rulers', async () => {
      await page.getByTestId('toggle-rulers').click()
      await page.waitForTimeout(600)
      await expect(page.locator('[data-ruler-overlay]')).toBeVisible()
      await page.getByRole('button', { name: /H Guide/ }).first().click()
      await expect(page.locator('[data-guide-id]').first()).toBeVisible()
    })

    await journey.step('editor-studio-designs', async () => {
      await page.getByTestId('tab-designs').click()
      await expect(page.getByText(/My designs/i).first()).toBeVisible()
    })

    await journey.step('editor-studio-timeline-strip', async () => {
      await page.getByTestId('tab-timeline').click()
      await page.getByRole('button', { name: /Timeline strip/i }).click()
      await expect(page.getByText(/Edit as video/i)).toBeVisible()
    })

    await journey.step('editor-studio-bulk', async () => {
      await page.getByTestId('btn-open-bulk').click()
      await expect(page.getByRole('heading', { name: /Bulk generate/i })).toBeVisible()
      await expect(page.getByText(/Design source/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /Generate batch/i })).toBeVisible()
    })
  },
}
