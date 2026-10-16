/**
 * Content board journey — the manual card lifecycle, step by step.
 *
 * The agent paths (Find ideas, Write now) need AI provider keys and are out of
 * scope. Everything below is deterministic once the **published Brand Playbook**
 * precondition is met: the board's update/delete capabilities refuse with
 * `BRAND_CONTEXT_REQUIRED` without one, so `setup` publishes a minimal playbook
 * first (see `../../e2e/helpers/content-fixtures.ts`).
 *
 * Step IDs come from `.cursor/skills/verify-magicsync/features/content-board.md`.
 * The route uses the `:id` pattern so the folder slug stays stable across runs.
 */
import { expect } from '@playwright/test'
import { publishBrandPlaybook } from '../../e2e/helpers/content-fixtures'
import { waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/business/:id/content'
const CARD_TITLE = 'E2E screenshot card'

export const contentBoardJourney: JourneyDefinition = {
  key: 'content-board',
  title: 'Content board — create, edit and delete a card by hand',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/content-board.md',
  preconditions: [
    'An active business owned by the fixture user.',
    'A published Brand Playbook — without it, update/delete return 500 BRAND_CONTEXT_REQUIRED.',
  ],
  notCovered: [
    'Find ideas (scan) — needs AI provider keys.',
    'Move to Writing (write now) — needs AI provider keys.',
    'Drag/drop refuse — drag-and-drop is flaky under Playwright and already covered by the component spec.',
  ],
  steps: [
    'board-open',
    'board-empty-column',
    'board-new-card',
    'board-card-persisted',
    'board-card-row',
    'board-card-menu',
    'board-card-updated',
    'board-delete-dialog',
    'board-card-deleted',
  ],

  async setup({ authed, user, business }: JourneyContext) {
    await publishBrandPlaybook(authed, user, business.id)
  },

  async run({ page, business, baseURL, journey }: JourneyContext) {
    const board = page.getByTestId('content-board')
    const planned = page.getByTestId('board-column-planned')
    const card = planned.getByRole('button', { name: CARD_TITLE, exact: true })

    // Reach the board for this business before the first step is captured.
    await page.goto(`${baseURL}${ROUTE.replace(':id', business.id)}`)
    await waitForHydration(page)
    await board.waitFor({ timeout: 60000 })

    await journey.step('board-open')

    await journey.step('board-empty-column', async () => {
      await expect(planned.getByTestId('board-empty-planned')).toBeVisible()
    })

    await journey.step('board-new-card', async () => {
      await page.getByTestId('new-card').click()
      await expect(page.getByTestId('card-create-modal')).toBeVisible()
      await page.getByTestId('card-create-title').fill(CARD_TITLE)
    })

    await journey.step('board-card-persisted', async () => {
      await page.getByTestId('card-create-save').click()
      await expect(page.getByTestId('card-create-modal')).toBeHidden()
      await expect(page.getByRole('heading', { name: 'Planned 1', exact: true })).toBeVisible()
      // Second view: the card must survive a reload, or it was never server-side.
      await page.reload()
      await waitForHydration(page)
      await board.waitFor()
      await expect(page.getByRole('heading', { name: 'Planned 1', exact: true })).toBeVisible()
    })

    await journey.step('board-card-row', async () => {
      // Card controls are hover-only — hover so they are in the shot.
      await card.hover()
    })

    await journey.step('board-card-menu', async () => {
      await planned.getByRole('button', { name: 'Card actions' }).click()
      await expect(page.getByRole('menuitem', { name: 'Edit title and brief' })).toBeVisible()
    })

    await journey.step('board-card-updated', async () => {
      await page.getByRole('menuitem', { name: 'Edit title and brief' }).click()
      await expect(page.getByTestId('card-edit-modal')).toBeVisible()
      await page.getByTestId('card-edit-title').fill(`${CARD_TITLE} v2`)
      await page.getByTestId('card-edit-save').click()
      await expect(page.getByTestId('card-edit-modal')).toBeHidden()
    })

    await journey.step('board-delete-dialog', async () => {
      const renamed = planned.getByRole('button', { name: `${CARD_TITLE} v2`, exact: true })
      await renamed.hover()
      await planned.getByRole('button', { name: 'Card actions' }).click()
      await page.getByRole('menuitem', { name: 'Delete card' }).click()
      await expect(page.getByTestId('card-delete-modal')).toBeVisible()
    })

    await journey.step('board-card-deleted', async () => {
      // Delete before the run ends so the fixture business is left clean.
      await page.getByTestId('card-delete-confirm').click()
      await expect(page.getByTestId('card-delete-modal')).toBeHidden()
      await expect(page.getByRole('heading', { name: 'Planned 0', exact: true })).toBeVisible()
    })
  },
}
