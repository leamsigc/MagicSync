import { test, expect } from '@playwright/test'
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createActiveBusiness, createTestAccount, createTestUser, loginWith, waitForHydration } from './helpers/e2e-utils'
import { captureRouteAction } from './helpers/route-screenshots'

/**
 * Seeds a business with posts (all statuses) and verifies + captures the new
 * /app/posts Feed master-detail view and the /app/business directory views.
 */

function db() {
  const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url))
  const env = readFileSync(envPath, 'utf8')
  const read = (key: string) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))![1]!.trim()
  return createClient({ url: read('NUXT_TURSO_DATABASE_URL'), authToken: read('NUXT_TURSO_AUTH_TOKEN') })
}

const now = () => Math.floor(Date.now() / 1000)

interface SeedPost {
  id: string
  content: string
  status: 'pending' | 'published' | 'failed'
  scheduledOffset: number
  published: boolean
  platform: string
  error?: string
}

test('posts feed + business directory', async ({ page, playwright }) => {
  test.setTimeout(300000)

  const authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const user = await createTestUser(authed)
  await loginWith(page, user)
  const business = await createActiveBusiness(authed, user, 'Acme Coffee Roasters')
  await createActiveBusiness(authed, user, 'Northwind Retail')
  await createActiveBusiness(authed, user, 'Globex Media')
  const account = await createTestAccount(user.id, business.id)

  const client = db()
  const posts: SeedPost[] = [
    { id: `seed-${Date.now()}-1`, content: 'Launch week is here — meet our new single-origin blend, roasted in small batches every Tuesday.', status: 'published', scheduledOffset: -86400, published: true, platform: 'linkedin' },
    { id: `seed-${Date.now()}-2`, content: 'Behind the counter: how we dial in every espresso shot before the doors open.', status: 'published', scheduledOffset: -172800, published: true, platform: 'twitter' },
    { id: `seed-${Date.now()}-3`, content: 'Draft: loyalty program teaser — free bag after ten stamps. Needs the final reward copy before scheduling.', status: 'pending', scheduledOffset: 86400, published: false, platform: 'facebook' },
    { id: `seed-${Date.now()}-4`, content: 'Weekend farmers market pop-up — come say hi, we are pouring free samples.', status: 'failed', scheduledOffset: -3600, published: false, platform: 'instagram', error: 'Instagram token expired for this account.' },
  ]

  for (const post of posts) {
    await client.execute({
      sql: `INSERT INTO posts (id, user_id, business_id, content, media_assets, scheduled_at, published_at, status, target_platforms, created_at, updated_at, platform_content, platform_settings, post_format, retry_count, repost_count)
            VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, '{"comment":[]}', '{}', 'post', 0, 0)`,
      args: [
        post.id, user.id, business.id, post.content,
        now() + post.scheduledOffset,
        post.published ? now() + post.scheduledOffset : null,
        post.status,
        JSON.stringify([account.id]),
        now() + post.scheduledOffset, now() + post.scheduledOffset,
      ],
    })
    if (post.published) {
      await client.execute({
        sql: `INSERT INTO platform_posts (id, post_id, social_account_id, platform_post_id, status, published_at, created_at)
              VALUES (?, ?, ?, ?, 'published', ?, ?)`,
        args: [`pp-${post.id}`, post.id, account.id, post.platform, now() + post.scheduledOffset, now()],
      })
    }
  }
  if (posts[3]) {
    await client.execute({ sql: 'UPDATE posts SET last_error = ? WHERE id = ?', args: [posts[3].error!, posts[3].id] })
  }

  // Connected providers are Better Auth `account` rows.
  for (const provider of ['facebook', 'linkedin', 'twitter', 'bluesky']) {
    await client.execute({
      sql: `INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [`prov-${provider}-${Date.now()}`, `ext-${provider}`, provider, user.id, now(), now()],
    })
  }

  // --- /app/posts Feed (master-detail) ---
  await page.goto('/app/posts')
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Feed', exact: true }).click()
  await page.waitForTimeout(800)
  await captureRouteAction(page, { route: '/app/posts', action: 'feed' })

  await page.getByRole('button', { name: /Draft: loyalty program teaser/i }).first().click()
  await page.waitForTimeout(400)
  await captureRouteAction(page, { route: '/app/posts', action: 'feed-detail' })

  // --- /app/posts/feeds/:id full detail ---
  await page.goto(`/app/posts/feeds/${posts[0]!.id}`)
  await waitForHydration(page)
  await expect(page.getByText(/Launch week is here/i).first()).toBeVisible()
  await captureRouteAction(page, { route: '/app/posts/feeds/:id', action: 'page' })

  // --- /app/business directory ---
  await page.goto('/app/business')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: /Acme Coffee Roasters/i }).first()).toBeVisible()
  await captureRouteAction(page, { route: '/app/business', action: 'page' })

  await page.getByRole('button', { name: 'List', exact: true }).click()
  await page.waitForTimeout(300)
  await captureRouteAction(page, { route: '/app/business', action: 'list' })

  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.waitForTimeout(300)
  await captureRouteAction(page, { route: '/app/business', action: 'table' })

  // --- /app/integrations providers directory ---
  await page.goto('/app/integrations')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: /Connect your social media accounts/i }).first()).toBeVisible()
  await captureRouteAction(page, { route: '/app/integrations', action: 'page' })

  await page.getByRole('button', { name: 'List', exact: true }).click()
  await page.waitForTimeout(300)
  await captureRouteAction(page, { route: '/app/integrations', action: 'list' })

  await page.getByRole('button', { name: 'Actions' }).first().click()
  await page.waitForTimeout(300)
  await captureRouteAction(page, { route: '/app/integrations', action: 'list-actions' })
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.waitForTimeout(300)
  await captureRouteAction(page, { route: '/app/integrations', action: 'table' })

  // --- desktop sidebar collapse toggle (DashboardHeader) ---
  await page.goto('/app/business')
  await waitForHydration(page)
  const sidebarRoot = page.locator('[data-slot="root"][data-collapsed]').first()
  await expect(sidebarRoot).toHaveAttribute('data-collapsed', 'false')
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebarRoot).toHaveAttribute('data-collapsed', 'true')
  await page.waitForTimeout(300)
  await captureRouteAction(page, { route: '/app/business', action: 'sidebar-collapsed' })
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(sidebarRoot).toHaveAttribute('data-collapsed', 'false')
})
