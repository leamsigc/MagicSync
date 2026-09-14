import { test, expect } from './fixtures'
import { createTestUser, createActiveBusiness, loginWith, blockHeavyAssets, waitForHydration, type TestUser, type TestBusiness } from './helpers/e2e-utils'

/**
 * Content board T05: create a card, walk it through states, and confirm the
 * approval gate is visible and blocks unapproved side effects.
 */

let user: TestUser
let business: TestBusiness

test.beforeAll(async ({ request }) => {
  test.setTimeout(180000)
  user = await createTestUser(request)
  business = await createActiveBusiness(request, user, 'Board E2E Business')
})

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
]

for (const viewport of viewports) {
  test.describe(`Content board (${viewport.label})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('creates a card, moves states, and shows the approval gate', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await page.goto(`/app/business/${business.id}/content`)
      await waitForHydration(page)

      const title = `E2E card ${Date.now()}`
      await page.getByTestId('board-create').click()
      await page.getByTestId('board-create-title').fill(title)
      await page.getByTestId('board-create-submit').click()
      await expect(page.getByText('Card created').first()).toBeVisible()

      const card = page.getByText(title).first()
      await expect(card).toBeVisible()

      // idea -> researching
      await card.click()
      await expect(page.getByTestId('board-action-research')).toBeVisible()
      await page.getByTestId('board-action-research').click()
      await expect(page.getByText(/Card moved to/i).first()).toBeVisible()

      // researching -> drafting -> review_required
      await page.getByTestId('board-action-generate').click()
      await page.getByTestId('board-action-submit-review').click()
      await expect(page.getByTestId('board-action-approve')).toBeVisible()

      // Approval requires a human-approved artifact: the gate must fail loudly.
      await page.getByTestId('board-action-approve').click()
      await expect(page.getByText(/Action failed/i).first()).toBeVisible()
      await expect(page.getByText(/artifact/i).first()).toBeVisible()

      await page.keyboard.press('Escape')
      const reviewColumn = page.getByTestId('board-column-review')
      await expect(reviewColumn.getByText(title)).toBeVisible()
    })
  })
}
