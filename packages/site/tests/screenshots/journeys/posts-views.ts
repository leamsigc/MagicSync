/**
 * Posts views journey — the shared collection shell on `/app/posts`.
 *
 * Proves the five declared views (Grid, List, Table, Feed, Board) and the live
 * published-post link that the board and feed detail expose.
 *
 * Creation/editing stays in the composer; this journey is read-only.
 */
import { expect } from '@playwright/test'
import {
  createPublishedPostFixture,
  createTestInstagramAccount,
  waitForHydration,
} from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/posts'
const CAPTION = 'E2E live post'
const LIVE_URL = 'https://instagram.com/p/E2E-LIVE-42'

export const postsViewsJourney: JourneyDefinition = {
  key: 'posts-views',
  title: 'Posts — grid, list, table, feed and board over one published post',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/create-post.md',
  preconditions: [
    'A signed-in user with an active business.',
    'One post already published on an Instagram account (fixture-written, with a live URL).',
  ],
  notCovered: [
    'Creating/scheduling a post — the composer is covered by the create-post journey.',
    'Deleting from the table — destructive and already covered by the table component.',
  ],
  steps: [
    'posts-feed',
    'posts-grid',
    'posts-list',
    'posts-table',
    'posts-board',
  ],

  async setup({ user, business }: JourneyContext) {
    const account = await createTestInstagramAccount(user.id, business.id)
    await createPublishedPostFixture(user.id, business.id, account.id, {
      caption: CAPTION,
      platformPostId: 'E2E-LIVE-42',
      publishedUrl: LIVE_URL,
    })
  },

  async run({ page, baseURL, journey }: JourneyContext) {
    await journey.step('posts-feed', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      // Default view: the master-detail Feed, with the live link on the post tab.
      await expect(page.getByText(CAPTION).first()).toBeVisible()
      await expect(page.locator(`a[href="${LIVE_URL}"]`).first()).toBeVisible()
    })

    await journey.step('posts-grid', async () => {
      await page.getByRole('button', { name: 'Grid', exact: true }).click()
      await expect(page.getByText(CAPTION).first()).toBeVisible()
    })

    await journey.step('posts-list', async () => {
      await page.getByRole('button', { name: 'List', exact: true }).click()
      await expect(page.getByText(CAPTION).first()).toBeVisible()
      await expect(page.locator(`a[href="${LIVE_URL}"]`).first()).toBeVisible()
    })

    await journey.step('posts-table', async () => {
      await page.getByRole('button', { name: 'Table', exact: true }).click()
      await expect(page.getByText(CAPTION).first()).toBeVisible()
    })

    await journey.step('posts-board', async () => {
      await page.getByRole('button', { name: 'Board', exact: true }).click()
      await expect(page.getByText(CAPTION).first()).toBeVisible()
    })
  },
}
