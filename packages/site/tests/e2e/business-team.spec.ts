import { test, expect } from '@playwright/test'
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createActiveBusiness, createTestUser, loginWith, waitForHydration } from './helpers/e2e-utils'
import { captureRouteAction } from './helpers/route-screenshots'

/**
 * Verifies the business edit page's Members surface: roster (members + pending
 * invitations), the invite modal, removing a member and the row actions menu.
 */

const ROUTE = '/app/business/:id/content/edit'

function db() {
  const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url))
  const env = readFileSync(envPath, 'utf8')
  const read = (key: string) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))![1]!.trim()
  return createClient({ url: read('NUXT_TURSO_DATABASE_URL'), authToken: read('NUXT_TURSO_AUTH_TOKEN') })
}

test('business team members surface', async ({ page, playwright }) => {
  test.setTimeout(300000)

  const authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const user = await createTestUser(authed)
  await loginWith(page, user)
  const business = await createActiveBusiness(authed, user, 'Acme Labs')
  const cookies = { [user.sessionCookie.name]: user.sessionCookie.value }

  // Inviting creates the organization (the inviter becomes owner) and leaves
  // two pending invitations behind.
  const invite = await authed.post(`/api/v1/business/${business.id}/invite`, {
    cookies,
    data: { emails: ['diego@freelance.io', 'priya@gr8studio.com'], role: 'member' },
  })
  expect(invite.ok()).toBeTruthy()

  // Seed a real, removable teammate (plain member) on the organization.
  const client = db()
  const orgRows = await client.execute({ sql: 'SELECT organization_id FROM member WHERE user_id = ? LIMIT 1', args: [user.id] })
  const organizationId = String(orgRows.rows[0]!.organization_id)
  const stamp = Date.now()
  const seconds = Math.floor(stamp / 1000)
  const mateUserId = `e2e-mate-user-${stamp}`
  const mateMemberId = `e2e-mate-${stamp}`
  await client.execute({
    sql: `INSERT INTO user (id, name, email, email_verified, role, banned, created_at, updated_at)
          VALUES (?, 'Sarah Chen', ?, 1, 'user', 0, ?, ?)`,
    args: [mateUserId, `sarah-${stamp}@gr8studio.com`, seconds, seconds],
  })
  await client.execute({
    sql: `INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES (?, ?, ?, 'member', ?)`,
    args: [mateMemberId, organizationId, mateUserId, seconds],
  })

  // `admin` must never be assignable from the business team API.
  const adminInvite = await authed.post(`/api/v1/business/${business.id}/invite`, {
    cookies,
    data: { emails: ['admin@example.com'], role: 'admin' },
  })
  expect(adminInvite.status()).toBe(400)

  const adminRole = await authed.patch(`/api/v1/business/${business.id}/members/${mateMemberId}`, {
    cookies,
    data: { role: 'admin' },
  })
  expect(adminRole.status()).toBe(400)

  await page.goto(`/app/business/${business.id}/content/edit`)
  await waitForHydration(page)

  // Roster renders members and pending invitations.
  await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible()
  await expect(page.getByText('Sarah Chen')).toBeVisible()
  await expect(page.getByText('diego@freelance.io').first()).toBeVisible()
  // `admin` is not offered as a role filter anywhere in the team surface.
  await expect(page.getByRole('button', { name: 'Admin', exact: true })).toHaveCount(0)
  await page.getByRole('heading', { name: 'Members', exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await captureRouteAction(page, { route: ROUTE, action: 'page', fullPage: false })

  // Invite modal — bulk mode.
  await page.getByRole('button', { name: 'Invite member' }).click()
  await page.getByRole('button', { name: 'Multiple emails' }).click()
  await page.waitForTimeout(400)
  await captureRouteAction(page, { route: ROUTE, action: 'invite-modal', fullPage: false })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Row actions + remove a member.
  const mateRow = page.getByRole('row', { name: /Sarah Chen/ })
  await mateRow.getByRole('button', { name: 'Team member actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Remove member' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Remove member' }).click()

  // Confirm via the toast action.
  await page.getByRole('button', { name: 'Remove member' }).last().click()
  await expect(page.getByRole('row', { name: /Sarah Chen/ })).toHaveCount(0)
  await captureRouteAction(page, { route: ROUTE, action: 'member-removed', fullPage: false })
})
