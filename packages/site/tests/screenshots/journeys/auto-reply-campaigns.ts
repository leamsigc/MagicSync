/**
 * Auto-reply campaign journey — the full campaign settings surface.
 *
 * Step IDs come from `.cursor/skills/verify-magicsync/features/auto-reply-campaigns.md`.
 * Everything runs on `/app/auto-reply`: the create and edit dialogs share one
 * component, and the post picker is a step inside that dialog (not a second
 * modal), so a single route folder tells the whole story.
 *
 * The published-post fixture matters: the picker only lists posts MagicSync
 * actually published (`platform_posts.status = 'published'` with a platform id),
 * never arbitrary native media.
 */
import { expect } from '@playwright/test'
import {
  createPublishedPostFixture,
  createTestInstagramAccount,
  waitForHydration,
} from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/auto-reply'
const CAMPAIGN_NAME = 'E2E keyword campaign'
const PUBLISHED_CAPTION = 'E2E published reel'
const PUBLISHED_PLATFORM_ID = '17900000000000042'

/** Picks the fixture account when the form did not preselect it. */
async function ensureAccountChosen({ page }: JourneyContext) {
  const placeholder = page.getByText('Select account', { exact: true })
  if (await placeholder.count() === 0) return
  await placeholder.click()
  await page.getByRole('option', { name: 'E2E Instagram' }).click()
}

export const autoReplyCampaignsJourney: JourneyDefinition = {
  key: 'auto-reply-campaigns',
  title: 'Auto-reply — create a campaign, watch a published post, then edit it',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/auto-reply-campaigns.md',
  preconditions: [
    'An active business owned by the fixture user.',
    'A connected Instagram account — fixtures insert one row directly into the dev DB.',
    'One post published through MagicSync on that account — the picker lists only those.',
  ],
  notCovered: [
    'AI-generated drafts — needs a live AI provider key and takes ~20s per call.',
    'A real DM delivery — needs Meta App Review with advanced access.',
    'Stats and click counts — no comment traffic exists in the fixture.',
  ],
  steps: [
    'autoreply-open',
    'autoreply-create',
    'autoreply-presets',
    'autoreply-posts-open',
    'autoreply-posts',
    'autoreply-keywords',
    'autoreply-links',
    'autoreply-test',
    'autoreply-save',
    'autoreply-toggle',
    'autoreply-edit',
    'autoreply-delete-confirm',
  ],

  async setup({ user, business }: JourneyContext) {
    const account = await createTestInstagramAccount(user.id, business.id)
    await createPublishedPostFixture(user.id, business.id, account.id, {
      caption: PUBLISHED_CAPTION,
      platformPostId: PUBLISHED_PLATFORM_ID,
    })
  },

  async run(context: JourneyContext) {
    const { page, baseURL, journey } = context

    await journey.step('autoreply-open', async () => {
      await page.goto(`${baseURL}${ROUTE}`)
      await waitForHydration(page)
      await expect(page.getByRole('heading', { name: 'Auto-Reply' })).toBeVisible()
    })

    await journey.step('autoreply-create', async () => {
      await page.getByRole('button', { name: 'New campaign' }).click()
      const dialog = page.getByRole('dialog').filter({ hasText: 'New campaign' })
      await expect(dialog).toBeVisible()
      await expect(page.getByText('Watch all posts from this account')).toBeVisible()
      await expect(page.getByText('AI-personalized reply')).toBeVisible()
      await expect(page.getByText('Trigger on story replies and inbound DMs')).toBeVisible()
      await expect(page.getByText('Require a follow before sending the link')).toBeVisible()
      await ensureAccountChosen(context)
    })

    await journey.step('autoreply-presets', async () => {
      await page.getByRole('button', { name: 'Link magnet' }).click()
      await expect(page.getByLabel('Keywords')).toHaveValue('LINK, INFO')
    })

    await journey.step('autoreply-posts-open', async () => {
      await page.getByRole('button', { name: 'Select posts' }).click()
      await expect(page.getByRole('dialog').filter({ hasText: 'Pick posts to watch' })).toBeVisible()
      // Only MagicSync-published rows are offered — the fixture caption is the single match.
      await expect(page.getByText(PUBLISHED_CAPTION)).toBeVisible()
    })

    await journey.step('autoreply-posts', async () => {
      await page.getByRole('button', { name: PUBLISHED_CAPTION }).click()
      await page.getByRole('button', { name: /Use 1 post/ }).click()
      await expect(page.getByPlaceholder('1789..., 1790...')).toHaveValue(PUBLISHED_PLATFORM_ID)
    })

    await journey.step('autoreply-keywords', async () => {
      await page.getByLabel('Campaign name').fill(CAMPAIGN_NAME)
      await page.getByLabel('Keywords').fill('LINK, INFO')
      await page.getByLabel('Match mode').click()
      await page.getByRole('option', { name: 'Whole word' }).click()
    })

    await journey.step('autoreply-links', async () => {
      await page.getByLabel('Link 1 label').fill('Shop')
      await page.getByLabel('Link 1 URL (https)').fill('https://shop.example.com')
      await page.getByLabel('Public reply').fill('Sent you a DM!')
    })

    await journey.step('autoreply-test', async () => {
      await page.getByPlaceholder('Type a comment, e.g. LINK please!').fill('LINK please!')
      await page.getByRole('button', { name: 'Test' }).click()
      await expect(page.getByText('Matched:')).toBeVisible()
    })

    await journey.step('autoreply-save', async () => {
      await page.getByRole('button', { name: 'Create campaign' }).click()
      // The toaster renders a hidden aria-live announcement with the same text.
      await expect(page.getByText('Campaign saved').filter({ visible: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: CAMPAIGN_NAME })).toBeVisible()
    })

    const card = page.locator('.rounded-xl').filter({ has: page.getByRole('button', { name: CAMPAIGN_NAME }) }).first()

    await journey.step('autoreply-toggle', async () => {
      await card.getByRole('switch').click()
      await expect(card.getByText('Disabled')).toBeVisible()
    })

    await journey.step('autoreply-edit', async () => {
      await card.getByRole('button', { name: 'Edit' }).click()
      const dialog = page.getByRole('dialog').filter({ hasText: 'Edit campaign' })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('Watched post IDs')).toBeVisible()
      await expect(dialog.getByLabel('Link 1 URL (https)')).toHaveValue('https://shop.example.com')
      await expect(dialog.getByText('Require a follow before sending the link')).toBeVisible()
      await dialog.getByRole('button', { name: 'Cancel' }).click()
    })

    await journey.step('autoreply-delete-confirm', async () => {
      await card.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('dialog').filter({ hasText: 'Delete campaign?' })).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()
    })
  },
}
