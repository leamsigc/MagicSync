import { test, expect } from '@playwright/test'
import { createTestUser, createActiveBusiness, loginWith } from './helpers/e2e-utils'

/**
 * T10.2 browser coverage for the Brand Playbook + corpus pages:
 * quiz intake covers every group, the review checklist renders from the
 * saved draft, and the corpus editor saves with feedback. Desktop runs at
 * the default viewport; the mobile block pins a phone viewport.
 */

test.describe.configure({ mode: 'serial' })

async function gotoPlaybook(page, playwright) {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const user = await createTestUser(api)
  const business = await createActiveBusiness(api, user)
  await loginWith(page, user)
  await page.goto(`/app/business/${business.id}/playbook`)
  return business
}

test.describe('Playbook UI (T10.2 desktop)', () => {
  test('quiz covers every intake group', async ({ page, playwright }) => {
    await gotoPlaybook(page, playwright)
    await page.getByRole('button', { name: 'Answer questions' }).click()
    for (const section of ['Identity', 'Audience', 'Voice', 'Positioning', 'Offers', 'Content hooks', 'Competitors', 'Keywords', 'Proof', 'Safety rules', 'Brand basics']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible()
    }
  })

  test('saved intake answers render the review checklist', async ({ page, playwright }) => {
    await gotoPlaybook(page, playwright)
    await page.getByRole('button', { name: 'Answer questions' }).click()
    await page.getByLabel('Who is your primary audience?').fill('Shop owners')
    await page.getByLabel('How should your brand sound? (e.g. bold, warm, playful)').fill('Bold')
    await page.getByRole('button', { name: 'Save answers as draft' }).click()
    const checklist = page.getByTestId('playbook-completion')
    await expect(checklist).toBeVisible()
    await expect(checklist.getByText(/fields missing/)).toBeVisible()
  })

  test('corpus editor saves a section with feedback', async ({ page, playwright }) => {
    const business = await gotoPlaybook(page, playwright)
    await page.goto(`/app/business/${business.id}/corpus`)
    await expect(page.getByTestId('corpus-readiness')).toBeVisible()
    const area = page.getByTestId('corpus-section-positioning').getByRole('textbox')
    await area.fill('We serve shop owners who struggle with no time.')
    await page.getByTestId('corpus-save-positioning').click()
    await expect(page.getByTestId('corpus-preview')).toContainText('shop owners')
  })
})

test.describe('Playbook UI (T10.2 mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('quiz and checklist are usable at phone width', async ({ page, playwright }) => {
    await gotoPlaybook(page, playwright)
    await page.getByRole('button', { name: 'Answer questions' }).click()
    await expect(page.getByRole('heading', { name: 'Safety rules' })).toBeVisible()
    await page.getByLabel('Which claims or topics must never appear?').fill('Fake guarantees')
    await page.getByRole('button', { name: 'Save answers as draft' }).click()
    await expect(page.getByTestId('playbook-completion')).toBeVisible()
  })
})
