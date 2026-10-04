import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { createTestUser, createActiveBusiness, loginWith, blockHeavyAssets, waitForHydration, type TestUser, type TestBusiness } from './helpers/e2e-utils'

/**
 * The content board and the idea view (PRD-CONTENT-PIPELINE-OVERHAUL §1.1–1.2 and
 * §10 D01–D03).
 *
 * Honesty note: this spec has never been executed — it needs a live server and
 * a running e2e stack, neither of which exists in this environment. It collects
 * only. Every agent-backed endpoint (`content/scan`, `content/write`,
 * `content/publish`), the routes the redesign adds calls for (`content/move`,
 * `content/update`, `content/delete`, `artifacts/:id/review`) and the platform
 * catalog are intercepted with the exact PRD §2 request and response shapes, so
 * what it would prove is the *UI contract*: which columns render, which request
 * a drop sends, which request the scan modal and the card menu send, the
 * busy/rollback path, and the request the Save and Publish controls send. The
 * capability layer itself is covered by `packages/agent/tests`.
 */

let user: TestUser
let business: TestBusiness

const PLANNED_ID = 'ci_e2e_planned'
const WRITING_ID = 'ci_e2e_writing'
const REVIEW_ID = 'ci_e2e_review'
const PUBLISHED_ID = 'ci_e2e_published'
const ADDED_ID = 'ci_e2e_added'

const BOARD_ITEMS = [
  { id: PLANNED_ID, title: 'Gutter maintenance before winter', brief: 'What a homeowner checks in October.', state: 'idea', platforms: ['facebook'], artifactId: null, priority: 3 },
  { id: WRITING_ID, title: 'Ice dams explained', brief: 'Why they form and what stops them.', state: 'drafting', platforms: ['linkedin'], artifactId: 'ca_e2e', priority: 2 },
  { id: REVIEW_ID, title: 'Choosing the right shingle', brief: 'A buyer guide with a price table.', state: 'review_required', platforms: ['facebook', 'instagram'], artifactId: 'ca_e2e', priority: 4 },
  { id: PUBLISHED_ID, title: 'Spring roofing checklist', brief: 'Twelve checks for every spring.', state: 'published', platforms: ['facebook'], artifactId: 'ca_e2e', priority: 5, postId: 'post_e2e' },
]

/** D01 — the server persists every idea and answers with its `itemId`. */
const SCAN_IDEAS = [
  { id: 'roof-maintenance-checklist', title: 'Roof maintenance checklist', brief: 'Ten checks a homeowner can do before winter.', platforms: ['facebook', 'instagram'], itemId: ADDED_ID },
]

const PLATFORM_CATALOG = [
  { name: 'facebook', display_name: 'Facebook', limits: { max_length: 63206, max_hashtags: 5 } },
  { name: 'linkedin', display_name: 'LinkedIn', limits: { max_length: 3000, max_hashtags: 5 } },
  { name: 'twitter', display_name: 'Twitter / X', limits: { max_length: 280, max_hashtags: 3 } },
]

const CONNECTIONS = {
  success: true,
  data: [
    { id: 'conn_wp', provider: 'wordpress', name: 'Blog', config: JSON.stringify({ siteUrl: 'https://blog.example.com' }), deliveryMode: 'draft', isActive: true, hasSecret: true, secret: null },
    { id: 'conn_gh', provider: 'github', name: 'Site repo', config: JSON.stringify({ repo: 'acme/site', branch: 'main' }), deliveryMode: 'commit', isActive: true, hasSecret: true, secret: null },
    { id: 'conn_off', provider: 'github', name: 'Disabled repo', config: JSON.stringify({ repo: 'acme/old' }), deliveryMode: 'commit', isActive: false, hasSecret: true, secret: null },
    { id: 'conn_nosecret', provider: 'wordpress', name: 'Unauthorised', config: JSON.stringify({ siteUrl: 'https://old.example.com' }), deliveryMode: 'draft', isActive: true, hasSecret: false, secret: null },
  ],
}

const ARTICLE = '# Roof maintenance\n\nStart at the flashing, not the shingles.\n\n- Check the step flashing\n- Clear the valleys\n'

const ITEM_DETAIL = {
  item: { id: REVIEW_ID, title: 'Choosing the right shingle', brief: 'A buyer guide with a price table.', state: 'review_required', platforms: ['facebook', 'instagram'], artifactId: 'ca_e2e', postId: null, priority: 4, updatedAt: '2026-10-02T09:00:00.000Z' },
  checks: [
    { id: 'chk_seo', kind: 'seo', status: 'warn', score: 60, findings: { missingCta: true, length: 180 } },
    { id: 'chk_geo', kind: 'geo', status: 'pass', score: 90, findings: {} },
  ],
  artifact: {
    id: 'ca_e2e',
    kind: 'social_post',
    status: 'review_required',
    version: 2,
    output: {
      outputKind: 'social_post_draft',
      caption: 'old caption',
      article: ARTICLE,
      cta: 'Call us today',
      platformVariants: {
        facebook: { caption: 'Choosing shingles starts with the flashing. #roofing', hashtags: ['roofing'] },
        linkedin: 'A bare string variant, because the wild is inconsistent.',
      },
    },
  },
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(180000)
  user = await createTestUser(request)
  business = await createActiveBusiness(request, user, 'Content Board E2E Business')
})

/** The board reads items, the business setting, and the owner's connections. */
async function stubBoardReads(page: Page, items: unknown[] = BOARD_ITEMS) {
  await stubBoardItemFeed(page, () => items)
}

/** Same reads, but the list can grow between requests — for the scan flow. */
async function stubBoardItemFeed(page: Page, feed: () => unknown[]) {
  await page.route('**/api/v1/content-items?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: feed() }),
  }))
  await page.route(/\/api\/v1\/business\/[^/]+\/safe-mode/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ safeMode: true }),
  }))
  await page.route('**/api/v1/publishing/connections?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(CONNECTIONS),
  }))
}

/** The platform catalog the scan modal reads — never hardcoded in the UI. */
async function stubPlatformCatalog(page: Page) {
  await page.route('**/api/ai-tools/social-media/platforms', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(PLATFORM_CATALOG),
  }))
}

/** PRD §2.1 + D01 — `{ ideas: [{ …, itemId }] }`; the server owns the rows. */
async function stubScan(page: Page, onRequest?: (body: Record<string, unknown>) => void) {
  await page.route('**/api/v1/content/scan', async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ideas: SCAN_IDEAS, sources: [{ label: 'Roofing industry report', url: 'https://example.com/report' }] }),
    })
  })
}

/** D04 — `content.update`, only the fields the owner changed. */
async function stubUpdate(page: Page, onRequest?: (body: Record<string, unknown>) => void) {
  await page.route('**/api/v1/content/update', async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

/** D02 — `content.delete`; irreversible, so the UI asks first. */
async function stubDelete(page: Page, onRequest?: (body: Record<string, unknown>) => void) {
  await page.route('**/api/v1/content/delete', async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

/** PRD §2.2 — `{ itemId, artifactId, article, checks }`. */
async function stubWrite(page: Page, onRequest?: (body: Record<string, unknown>) => void) {
  await page.route('**/api/v1/content/write', async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ itemId: WRITING_ID, artifactId: 'ca_e2e', article: ARTICLE, checks: [] }),
    })
  })
}

/** `content.move` — `{ itemId, to }`. A thin adapter; no agent work. */
async function stubMove(page: Page, onRequest?: (body: Record<string, unknown>) => void) {
  await page.route('**/api/v1/content/move', async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })
}

/** Approving the artifact is a separate call, and needs its exact version. */
async function stubReview(page: Page, onRequest?: (body: Record<string, unknown>) => void) {
  await page.route('**/api/v1/artifacts/ca_e2e/review*', async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { artifact: { id: 'ca_e2e', status: 'approved', version: 2 }, record: { id: 'ap_e2e', decision: 'approved' } } }),
    })
  })
}

/** PRD §2.3 — `{ itemId, artifactId, jobId, postId }`. */
async function stubPublish(page: Page, onRequest?: (body: Record<string, unknown>) => void) {
  await page.route('**/api/v1/content/publish', async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ itemId: PUBLISHED_ID, artifactId: 'ca_e2e', jobId: 'job_e2e', postId: 'post_e2e' }),
    })
  })
}

async function openBoard(page: Page) {
  await page.goto(`/app/business/${business.id}/content`)
  await waitForHydration(page)
  await expect(page.getByTestId('content-board')).toBeVisible()
}

test.describe('Content board: four columns', () => {
  test.setTimeout(60000)

  test('renders four columns with counts, the mode line, and an Empty column', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    await openBoard(page)

    for (const [column, count] of [['planned', '1'], ['approved', '1'], ['writing', '1'], ['published', '1']] as const) {
      await expect(page.getByTestId(`board-column-${column}`)).toBeVisible()
      await expect(page.getByTestId(`board-count-${column}`)).toHaveText(count)
      await expect(page.getByTestId(`board-column-${column}`)).toContainText({ planned: 'Planned', approved: 'Approved', writing: 'Writing', published: 'Published' }[column])
    }

    // A card sits in the column its state maps to, not where it was last seen.
    await expect(page.getByTestId(`board-column-planned`).getByTestId(`board-card-${PLANNED_ID}`)).toBeVisible()
    await expect(page.getByTestId(`board-column-writing`).getByTestId(`board-card-${WRITING_ID}`)).toBeVisible()
    await expect(page.getByTestId(`board-column-approved`).getByTestId(`board-card-${REVIEW_ID}`)).toBeVisible()
    await expect(page.getByTestId(`board-column-published`).getByTestId(`board-card-${PUBLISHED_ID}`)).toBeVisible()

    // The mode line explains itself and offers the one switch.
    await expect(page.getByTestId('board-mode')).toContainText('Safe mode')
    await expect(page.getByTestId('board-mode-switch')).toHaveText('Switch to Autonomous')

    // Only connections that are active and hold a secret are offered, and the
    // config JSON is read for the site URL / repo. The first one is selected.
    const picker = page.getByTestId('publish-target')
    await expect(picker).toBeVisible()
    await expect(picker).toContainText('Blog — https://blog.example.com')
    await picker.click()
    await expect(page.getByRole('option', { name: /Site repo — acme\/site/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Disabled repo/ })).toHaveCount(0)
    await expect(page.getByRole('option', { name: /Unauthorised/ })).toHaveCount(0)
  })

  test('an empty column says Empty', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page, [BOARD_ITEMS[0]!])

    await openBoard(page)
    await expect(page.getByTestId('board-empty-approved')).toBeVisible()
    await expect(page.getByTestId('board-empty-published')).toHaveText('Empty')
  })

  test('a planned card offers Write now; a published card offers Edit and View', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    await openBoard(page)
    await expect(page.getByTestId(`board-card-write-${PLANNED_ID}`)).toHaveText('Write now')
    await expect(page.getByTestId(`board-card-write-${WRITING_ID}`)).toHaveCount(0)
    await expect(page.getByTestId(`board-card-edit-${PUBLISHED_ID}`)).toHaveText('Edit')
    await expect(page.getByTestId(`board-card-view-${PUBLISHED_ID}`)).toHaveAttribute('href', 'https://blog.example.com')
  })

  test('Switching the mode PUTs the setting', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const bodies: Record<string, unknown>[] = []
    await page.route(/\/api\/v1\/business\/[^/]+\/safe-mode/, async (route) => {
      if (route.request().method() === 'PUT') {
        bodies.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ safeMode: false }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ safeMode: true }) })
    })

    await openBoard(page)
    await page.getByTestId('board-mode-switch').click()
    await expect.poll(() => bodies.length).toBe(1)
    expect(bodies[0]).toEqual({ safeMode: false })
    await expect(page.getByTestId('board-mode')).toContainText('Autonomous mode')
  })
})

test.describe('D01 — Find ideas is a modal, and its results are the cards', () => {
  test.setTimeout(60000)

  test('the dialog offers the server catalog and needs a platform before it can run', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)
    await stubPlatformCatalog(page)
    await stubScan(page)

    await openBoard(page)
    await page.getByTestId('find-ideas').click()
    await expect(page.getByTestId('scan-modal')).toBeVisible()

    // The platform list is the catalog's, in its own wording.
    for (const platform of PLATFORM_CATALOG) {
      await expect(page.getByTestId(`scan-platform-${platform.name}`)).toContainText(platform.display_name)
    }
    // Nothing preselected: the choice is the decision, so the run waits for it.
    await expect(page.getByTestId('scan-confirm')).toBeDisabled()

    await page.getByTestId('scan-platform-linkedin').click()
    await expect(page.getByTestId('scan-confirm')).toBeEnabled()
  })

  test('confirming sends the topic and the platforms, and the ideas become Planned cards', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)

    const items: Record<string, unknown>[] = []
    await stubBoardItemFeed(page, () => items)
    await stubPlatformCatalog(page)

    const scans: Record<string, unknown>[] = []
    await stubScan(page, body => {
      scans.push(body)
      // The server persisted the idea; the board's next read returns it.
      items.push({ id: ADDED_ID, title: SCAN_IDEAS[0]!.title, brief: SCAN_IDEAS[0]!.brief, state: 'idea', platforms: ['facebook', 'instagram'], artifactId: null, priority: 3 })
    })

    await openBoard(page)
    await expect(page.getByTestId('board-empty-planned')).toBeVisible()
    await page.getByTestId('find-ideas').click()
    await page.getByTestId('scan-topic').fill('roof maintenance')
    await page.getByTestId('scan-platform-facebook').click()
    await page.getByTestId('scan-platform-linkedin').click()
    await page.getByTestId('scan-confirm').click()

    await expect.poll(() => scans.length).toBe(1)
    expect(scans[0]).toEqual({
      businessId: business.id,
      topic: 'roof maintenance',
      platforms: ['facebook', 'linkedin'],
    })

    // The dialog closes, there is no second "add to board" step, and the card
    // the server created is simply there on the next read.
    await expect(page.getByTestId('scan-modal')).toBeHidden()
    await expect(page.getByTestId(`board-card-${ADDED_ID}`)).toBeVisible()
    await expect(page.getByTestId('board-count-planned')).toHaveText('1')
    await expect(page.getByText('New ideas in Planned: 1').first()).toBeVisible()
  })

  test('an empty topic is omitted rather than sent as blank', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page, [])
    await stubPlatformCatalog(page)

    const scans: Record<string, unknown>[] = []
    await stubScan(page, body => scans.push(body))

    await openBoard(page)
    await page.getByTestId('find-ideas').click()
    await page.getByTestId('scan-platform-twitter').click()
    await page.getByTestId('scan-confirm').click()

    await expect.poll(() => scans.length).toBe(1)
    expect(scans[0]).toEqual({ businessId: business.id, platforms: ['twitter'] })
  })

  test('a refused scan keeps the dialog open and says why', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page, [])
    await stubPlatformCatalog(page)
    await page.route('**/api/v1/content/scan', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusMessage: 'The research provider timed out', data: { code: 'PROVIDER_TIMEOUT' } }),
    }))

    await openBoard(page)
    await page.getByTestId('find-ideas').click()
    await page.getByTestId('scan-platform-facebook').click()
    await page.getByTestId('scan-confirm').click()

    await expect(page.getByText('The research provider timed out').first()).toBeVisible()
    await expect(page.getByTestId('scan-modal')).toBeVisible()
  })

  test('a scan that returns nothing says so instead of pretending it added something', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page, [])
    await stubPlatformCatalog(page)
    await page.route('**/api/v1/content/scan', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ideas: [], sources: [] }),
    }))

    await openBoard(page)
    await page.getByTestId('find-ideas').click()
    await page.getByTestId('scan-platform-facebook').click()
    await page.getByTestId('scan-confirm').click()

    await expect(page.getByText('The agent found no ideas for this topic').first()).toBeVisible()
    await expect(page.getByTestId('board-empty-planned')).toBeVisible()
  })
})

test.describe('D02 — every card carries its own CRUD menu', () => {
  test.setTimeout(60000)

  test('the menu edits the title and sends only the field that changed', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)

    const items = BOARD_ITEMS.map(item => ({ ...item }))
    await stubBoardItemFeed(page, () => items)
    const updates: Record<string, unknown>[] = []
    await stubUpdate(page, (body) => {
      updates.push(body)
      const row = items.find(entry => entry.id === PLANNED_ID)!
      Object.assign(row, { title: body.title ?? row.title })
    })

    await openBoard(page)
    // The menu trigger is its own control: it must not open the card.
    await page.getByTestId(`board-card-menu-${PLANNED_ID}`).click()
    await page.getByRole('menuitem', { name: 'Edit title and brief' }).click()
    await expect(page.getByTestId('card-edit-modal')).toBeVisible()
    await expect(page.getByTestId('card-edit-brief')).toHaveValue('What a homeowner checks in October.')

    await page.getByTestId('card-edit-title').fill('Gutter maintenance before winter (2026)')
    await page.getByTestId('card-edit-save').click()

    await expect.poll(() => updates.length).toBe(1)
    expect(updates[0]).toEqual({
      businessId: business.id,
      itemId: PLANNED_ID,
      title: 'Gutter maintenance before winter (2026)',
    })
    await expect(page.getByTestId('card-edit-modal')).toBeHidden()
    await expect(page.getByTestId(`board-card-${PLANNED_ID}`)).toContainText('(2026)')
  })

  test('saving the brief sends the brief, and only when it differs', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)
    const updates: Record<string, unknown>[] = []
    await stubUpdate(page, body => updates.push(body))

    await openBoard(page)
    await page.getByTestId(`board-card-menu-${WRITING_ID}`).click()
    await page.getByRole('menuitem', { name: 'Edit title and brief' }).click()
    // Unchanged: the control says so instead of POSTing the same values back.
    await expect(page.getByTestId('card-edit-save')).toBeDisabled()

    await page.getByTestId('card-edit-brief').fill('Why ice dams form, and what actually stops them.')
    await page.getByTestId('card-edit-save').click()

    await expect.poll(() => updates.length).toBe(1)
    expect(updates[0]).toEqual({
      businessId: business.id,
      itemId: WRITING_ID,
      brief: 'Why ice dams form, and what actually stops them.',
    })
  })

  test('delete asks first, then sends the item and takes the card off the board', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)

    const items = BOARD_ITEMS.map(item => ({ ...item }))
    await stubBoardItemFeed(page, () => items)
    const deletes: Record<string, unknown>[] = []
    await stubDelete(page, (body) => {
      deletes.push(body)
      const index = items.findIndex(entry => entry.id === REVIEW_ID)
      items.splice(index, 1)
    })

    await openBoard(page)
    await page.getByTestId(`board-card-menu-${REVIEW_ID}`).click()
    await page.getByRole('menuitem', { name: 'Delete card' }).click()

    // Nothing is deleted by opening the menu or the dialog.
    await expect(page.getByTestId('card-delete-modal')).toBeVisible()
    expect(deletes).toHaveLength(0)

    await page.getByTestId('card-delete-confirm').click()
    await expect.poll(() => deletes.length).toBe(1)
    expect(deletes[0]).toEqual({ businessId: business.id, itemId: REVIEW_ID })
    await expect(page.getByTestId(`board-card-${REVIEW_ID}`)).toHaveCount(0)
    await expect(page.getByTestId('board-count-approved')).toHaveText('0')
    await expect(page.getByText('Card deleted').first()).toBeVisible()
  })

  test('cancelling the confirmation deletes nothing', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const deletes: Record<string, unknown>[] = []
    await stubDelete(page, body => deletes.push(body))

    await openBoard(page)
    await page.getByTestId(`board-card-menu-${PLANNED_ID}`).click()
    await page.getByRole('menuitem', { name: 'Delete card' }).click()
    await page.getByTestId('card-delete-cancel').click()

    await expect(page.getByTestId('card-delete-modal')).toBeHidden()
    expect(deletes).toHaveLength(0)
    await expect(page.getByTestId(`board-card-${PLANNED_ID}`)).toBeVisible()
  })
})

test.describe('D03 — a brief is prose, never JSON', () => {
  test.setTimeout(60000)

  test('an envelope is unwrapped and an unusable one renders no line at all', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page, [
      { ...BOARD_ITEMS[0]!, id: PLANNED_ID, brief: '{"brief": "Ten checks a homeowner can do.", "title": "Roof maintenance"}' },
      { ...BOARD_ITEMS[1]!, id: WRITING_ID, brief: '{"brief": "Why they form and what stops them' },
      { ...BOARD_ITEMS[2]!, id: REVIEW_ID, brief: '{"topics": ["a", "b"]}' },
    ])

    await openBoard(page)
    await expect(page.getByTestId(`board-card-angle-${PLANNED_ID}`)).toHaveText('Ten checks a homeowner can do.')
    await expect(page.getByTestId(`board-card-angle-${WRITING_ID}`)).toHaveCount(0)
    await expect(page.getByTestId(`board-card-angle-${REVIEW_ID}`)).toHaveCount(0)

    // PRD §10.2: nothing on the card looks like an envelope.
    const angles = page.locator('[data-testid^="board-card-angle-"]')
    const texts = await angles.allTextContents()
    expect(texts.filter(Boolean).join(' ')).not.toMatch(/[[\]{}]/)
  })

  test('the edit dialog opens on the prose, not on the envelope', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page, [
      { ...BOARD_ITEMS[0]!, brief: '```json\n{"brief": "Ten checks a homeowner can do."}\n```' },
    ])
    await stubUpdate(page)

    await openBoard(page)
    await page.getByTestId(`board-card-menu-${PLANNED_ID}`).click()
    await page.getByRole('menuitem', { name: 'Edit title and brief' }).click()
    await expect(page.getByTestId('card-edit-brief')).toHaveValue('Ten checks a homeowner can do.')
    await expect(page.getByTestId('card-edit-save')).toBeDisabled()
  })
})

test.describe('Content board: a drop runs the destination column action', () => {
  test.setTimeout(60000)

  test('Writing runs content.write with stopAt drafting', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const writes: Record<string, unknown>[] = []
    const moves: Record<string, unknown>[] = []
    await stubWrite(page, body => writes.push(body))
    await stubMove(page, body => moves.push(body))

    await openBoard(page)
    await page.getByTestId(`board-card-${PLANNED_ID}`).dragTo(page.getByTestId('board-dropzone-writing'))

    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0]).toMatchObject({
      businessId: business.id,
      itemId: PLANNED_ID,
      stopAt: 'drafting',
      idea: { title: 'Gutter maintenance before winter' },
      platforms: ['facebook'],
    })
    // Writing is never a plain move.
    expect(moves).toHaveLength(0)
  })

  test('Approved runs a plain content.move with no agent work', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const moves: Record<string, unknown>[] = []
    const writes: Record<string, unknown>[] = []
    await stubMove(page, body => moves.push(body))
    await stubWrite(page, body => writes.push(body))

    await openBoard(page)
    await page.getByTestId(`board-card-${WRITING_ID}`).dragTo(page.getByTestId('board-dropzone-approved'))

    await expect.poll(() => moves.length).toBe(1)
    expect(moves[0]).toMatchObject({ businessId: business.id, itemId: WRITING_ID, to: 'review_required' })
    expect(writes).toHaveLength(0)
  })

  test('Published approves the artifact, then publishes to the chosen connection', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const reviews: Record<string, unknown>[] = []
    const publishes: Record<string, unknown>[] = []
    await page.route(`**/api/v1/content-items/${REVIEW_ID}?*`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...ITEM_DETAIL, item: { ...ITEM_DETAIL.item, id: REVIEW_ID } }),
    }))
    await stubReview(page, body => reviews.push(body))
    await stubPublish(page, body => publishes.push(body))

    await openBoard(page)
    await page.getByTestId(`board-card-${REVIEW_ID}`).dragTo(page.getByTestId('board-dropzone-published'))

    await expect.poll(() => publishes.length).toBe(1)
    // Approval first, on the version the item actually holds.
    expect(reviews).toHaveLength(1)
    expect(reviews[0]).toMatchObject({ decision: 'approved', version: 2 })
    // And the release carries the picker, not a hardcoded provider.
    expect(publishes[0]).toMatchObject({ businessId: business.id, itemId: REVIEW_ID, provider: 'wordpress', connectionId: 'conn_wp', confirm: true })
  })

  test('a drop into the column a card already sits in does nothing at all', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const calls: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/api/v1/content/move') || url.includes('/api/v1/content/write') || url.includes('/api/v1/content/publish')) calls.push(url)
    })

    await openBoard(page)
    await page.getByTestId(`board-card-${PLANNED_ID}`).dragTo(page.getByTestId('board-dropzone-planned'))
    await page.waitForTimeout(300)

    expect(calls).toHaveLength(0)
    await expect(page.getByTestId(`board-column-planned`).getByTestId(`board-card-${PLANNED_ID}`)).toBeVisible()
  })

  test('Write now runs the Writing action without a drag', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const writes: Record<string, unknown>[] = []
    await stubWrite(page, body => writes.push(body))

    await openBoard(page)
    await page.getByTestId(`board-card-write-${PLANNED_ID}`).click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0]).toMatchObject({ itemId: PLANNED_ID, stopAt: 'drafting' })
  })

  test('the move buttons are the keyboard path and send the same move', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    const moves: Record<string, unknown>[] = []
    await stubMove(page, body => moves.push(body))

    await openBoard(page)
    // The first column cannot move further left, and the control says so.
    await expect(page.getByTestId(`board-card-left-${PLANNED_ID}`)).toBeDisabled()
    await expect(page.getByTestId(`board-card-right-${PLANNED_ID}`)).toBeEnabled()

    await page.getByTestId(`board-card-${PLANNED_ID}`).hover()
    await page.getByTestId(`board-card-right-${PLANNED_ID}`).click()
    await expect.poll(() => moves.length).toBe(1)
    expect(moves[0]).toMatchObject({ itemId: PLANNED_ID, to: 'review_required' })
  })

  test('the card shows a busy state and the board locks while an action runs', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    let release: (() => void) | undefined
    await page.route('**/api/v1/content/write', async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ itemId: PLANNED_ID, artifactId: 'ca_e2e', article: ARTICLE, checks: [] }),
      })
    })

    await openBoard(page)
    await page.getByTestId(`board-card-write-${PLANNED_ID}`).click()
    await expect(page.getByTestId('board-card-busy')).toBeVisible()
    await expect(page.getByTestId('content-board')).toHaveClass(/pointer-events-none/)
    release?.()
    await expect(page.getByTestId('board-card-busy')).toHaveCount(0)
  })

  test('a server refusal rolls the card back and toasts the coded error', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)

    await page.route('**/api/v1/content/move', route => route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ statusMessage: 'An agent may not move a card out of a published state', data: { code: 'FORBIDDEN' } }),
    }))

    await openBoard(page)
    await page.getByTestId(`board-card-${WRITING_ID}`).hover()
    await page.getByTestId(`board-card-left-${WRITING_ID}`).click()

    await expect(page.getByText('An agent may not move a card out of a published state').first()).toBeVisible()
    // The card never half-moved: it is still in Writing after the reload.
    await expect(page.getByTestId(`board-column-writing`).getByTestId(`board-card-${WRITING_ID}`)).toBeVisible()
    await expect(page.getByTestId('board-count-writing')).toHaveText('1')
  })
})

test.describe('Idea view', () => {
  test.setTimeout(60000)

  async function openIdea(page: Page, detail: unknown = ITEM_DETAIL) {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await stubBoardReads(page)
    await page.route(`**/api/v1/content-items/${REVIEW_ID}?*`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detail),
    }))
    await page.goto(`/app/business/${business.id}/content/${REVIEW_ID}`)
    await waitForHydration(page)
  }

  test('renders the article with comark, plus state, checks, findings and social posts', async ({ page }) => {
    await openIdea(page)

    await expect(page.getByTestId('idea-title')).toHaveText('Choosing the right shingle')
    await expect(page.getByTestId('idea-state')).toContainText('Ready for review')

    // comark rendered the stored markdown, not the raw string.
    const preview = page.getByTestId('article-preview')
    await expect(preview).toBeVisible()
    await expect(preview.getByRole('heading', { name: 'Roof maintenance' })).toBeVisible()
    await expect(preview).toContainText('Start at the flashing, not the shingles.')
    await expect(preview).not.toContainText('## Roof maintenance')

    // Checks carry their scores, and the findings that used to be dropped.
    await expect(page.getByTestId('check-score-seo')).toHaveText('60/100')
    await expect(page.getByTestId('check-seo')).toContainText('No call to action')
    await expect(page.getByTestId('check-seo')).toContainText('180')

    // Both variant shapes render: the `{ caption }` record and the bare string.
    await expect(page.getByTestId('social-post-facebook')).toContainText('Choosing shingles starts with the flashing.')
    await expect(page.getByTestId('social-post-linkedin')).toContainText('A bare string variant')

    await expect(page.getByTestId('idea-words')).toHaveText(/Words: \d+/)
    await expect(page.getByTestId('idea-version')).toHaveText('v2')
  })

  test('Meta reveals the item facts', async ({ page }) => {
    await openIdea(page)
    await expect(page.getByTestId('idea-meta-panel')).toHaveCount(0)
    await page.getByTestId('idea-meta').click()
    await expect(page.getByTestId('idea-meta-panel')).toBeVisible()
    await expect(page.getByTestId('idea-meta-panel')).toContainText('facebook, instagram')
  })

  test('Save sends the whole output with only the article swapped', async ({ page }) => {
    await openIdea(page)
    const edits: Record<string, unknown>[] = []
    await page.route('**/api/v1/artifacts/ca_e2e/edit*', async (route) => {
      edits.push(route.request().postDataJSON() as Record<string, unknown>)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { version: 3 } }) })
    })

    await page.getByTestId('idea-edit').click()
    await expect(page.getByTestId('idea-editor-wrap')).toBeVisible()
    await expect(page.getByTestId('idea-save')).toBeDisabled()

    // The editor is a ProseMirror surface; type into its contenteditable node.
    await page.getByTestId('article-editor').locator('[contenteditable="true"]').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' plus a new paragraph.')
    await expect(page.getByTestId('idea-save')).toBeEnabled()
    await page.getByTestId('idea-save').click()

    await expect.poll(() => edits.length).toBe(1)
    expect(edits[0]).toMatchObject({ version: 2 })
    const output = edits[0]!.output as Record<string, unknown>
    expect(output).toMatchObject({ outputKind: 'social_post_draft', cta: 'Call us today', caption: 'old caption' })
    expect(output.platformVariants).toBeDefined()
    expect(String(output.article)).toContain('plus a new paragraph.')
    await expect(page.getByTestId('idea-version')).toHaveText('v3')
    await page.getByTestId('idea-preview').click()
    await expect(page.getByTestId('article-preview')).toBeVisible()
  })

  test('Safe Mode ON makes publish two presses and sends the chosen connection', async ({ page }) => {
    await openIdea(page)
    const publishes: Record<string, unknown>[] = []
    await stubPublish(page, body => publishes.push(body))

    await page.getByTestId('idea-publish').click()
    await expect(page.getByTestId('idea-publish')).toHaveText(/Publish now\?/)
    expect(publishes).toHaveLength(0)

    await page.getByTestId('idea-publish').click()
    await expect.poll(() => publishes.length).toBe(1)
    expect(publishes[0]).toMatchObject({
      businessId: business.id,
      itemId: REVIEW_ID,
      provider: 'wordpress',
      connectionId: 'conn_wp',
      confirm: true,
    })
    await expect(page.getByTestId('idea-publish-outcome')).toBeVisible()
    await expect(page.getByText('post_e2e').first()).toBeVisible()
  })

  test('an unpublished item can be pulled back out of Published', async ({ page }) => {
    const published = {
      ...ITEM_DETAIL,
      item: { ...ITEM_DETAIL.item, state: 'published' },
      artifact: { ...ITEM_DETAIL.artifact, status: 'approved' },
    }
    await openIdea(page, published)
    const moves: Record<string, unknown>[] = []
    await stubMove(page, body => moves.push(body))

    await expect(page.getByTestId('idea-unpublish')).toBeVisible()
    await page.getByTestId('idea-unpublish').click()
    await expect.poll(() => moves.length).toBe(1)
    expect(moves[0]).toMatchObject({ itemId: REVIEW_ID, to: 'review_required' })
  })

  test('an item with no article offers Write now and blocks publishing', async ({ page }) => {
    const empty = { ...ITEM_DETAIL, artifact: null, checks: [] }
    await openIdea(page, empty)
    await expect(page.getByTestId('idea-write')).toBeVisible()
    await expect(page.getByTestId('idea-publish')).toBeDisabled()
    await expect(page.getByTestId('article-preview')).toContainText('No article yet')
  })

  test('the editor never posts to /api/v1/posts — one publish path only', async ({ page }) => {
    await openIdea(page)
    const posted: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/posts') && request.method() === 'POST') posted.push(request.url())
    })
    await page.getByTestId('idea-publish').click()
    expect(posted).toHaveLength(0)
  })
})