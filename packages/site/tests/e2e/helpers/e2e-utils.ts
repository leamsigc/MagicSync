import { createClient, type Client } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * Real end-to-end auth helper for the unified site package.
 *
 * Creates a genuine user through Better Auth's HTTP API on the running
 * Nuxt server, verifies the email directly in the local libSQL database,
 * signs in and returns the session cookies so Playwright contexts are
 * authenticated for every SSR + client request (no route mocking).
 */

let dbClient: Client | null = null

function getDb(): Client {
  if (!dbClient) {
    const envPath = fileURLToPath(new URL('../../../../../.env', import.meta.url))
    const env = readFileSync(envPath, 'utf8')
    const read = (key: string): string => {
      const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
      if (!match) throw new Error(`Missing ${key} in .env`)
      return match[1].trim()
    }
    dbClient = createClient({
      url: read('NUXT_TURSO_DATABASE_URL'),
      authToken: read('NUXT_TURSO_AUTH_TOKEN'),
    })
  }
  return dbClient
}

export interface TestUser {
  id: string
  email: string
  password: string
  firstName: string
  lastName: string
  sessionCookie: { name: string, value: string }
}

const usedEmails = new Set<string>()

/** Creates a unique verified user via the real signup + signin APIs. */
export async function createTestUser(request: APIRequestContext): Promise<TestUser> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const user = {
    email: `e2e-${suffix}@test.magicsync.dev`,
    password: `TestPass${suffix}!aA1`,
    firstName: 'E2E',
    lastName: 'Tester',
    id: '',
    sessionCookie: { name: 'better-auth.session_token', value: '' },
  }
  usedEmails.add(user.email)

  // 1. Sign up through the real Better Auth endpoint
  const signUp = await request.post('/api/auth/sign-up/email', {
    data: {
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: user.password,
    },
  })
  if (!signUp.ok()) {
    throw new Error(`Signup failed (${signUp.status()}): ${await signUp.text()}`)
  }
  const { user: created } = await signUp.json()
  user.id = created.id

  // 2. Bypass email verification straight in the local dev database
  await getDb().execute({
    sql: 'UPDATE user SET email_verified = 1 WHERE id = ?',
    args: [user.id],
  })

  // 3. Sign in and capture the session cookie
  const signIn = await request.post('/api/auth/sign-in/email', {
    data: { email: user.email, password: user.password },
  })
  if (!signIn.ok()) {
    throw new Error(`Signin failed (${signIn.status()}): ${await signIn.text()}`)
  }
  const setCookie = signIn.headersArray().find(h => h.name.toLowerCase() === 'set-cookie')
  if (!setCookie) throw new Error('No session cookie returned from sign-in')
  const raw = setCookie.value.split(';')[0] // better-auth.session_token=...
  const eq = raw.indexOf('=')
  user.sessionCookie = { name: raw.slice(0, eq), value: raw.slice(eq + 1) }

  return user
}

/**
 * Promote a fixture user to admin and refresh its session cookie.
 *
 * better-auth's cookie cache carries the role captured at sign-in, so the role
 * must be written before a new sign-in: otherwise admin APIs keep answering 403
 * for the life of the cached session.
 */
export async function promoteToAdmin(request: APIRequestContext, user: TestUser): Promise<TestUser> {
  await getDb().execute({ sql: "UPDATE user SET role = 'admin' WHERE id = ?", args: [user.id] })
  // The request context already holds a session cookie, so better-auth's CSRF
  // guard requires an Origin on this second sign-in.
  const signIn = await request.post('/api/auth/sign-in/email', {
    headers: { origin: process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000' },
    data: { email: user.email, password: user.password },
  })
  if (!signIn.ok()) throw new Error(`Admin re-signin failed (${signIn.status()}): ${await signIn.text()}`)
  const setCookie = signIn.headersArray().find(h => h.name.toLowerCase() === 'set-cookie')
  if (!setCookie) throw new Error('No session cookie returned from the admin sign-in')
  const raw = setCookie.value.split(';')[0]
  const eq = raw.indexOf('=')
  user.sessionCookie = { name: raw.slice(0, eq), value: raw.slice(eq + 1) }
  return user
}

/** Applies the session cookie to a browser context. */
export async function loginWith(page: Page, user: TestUser): Promise<void> {
  await page.context().addCookies([{
    ...user.sessionCookie,
    domain: 'localhost',
    path: '/',
  }])
}

export interface TestBusiness {
  id: string
  name: string
}

/** Creates an active business for the user through the real API. */
export async function createActiveBusiness(
  request: APIRequestContext,
  user: TestUser,
  name = 'E2E Business',
): Promise<TestBusiness> {
  const response = await request.post('/api/v1/business', {
    cookies: { [user.sessionCookie.name]: user.sessionCookie.value },
    data: {
      name,
      description: 'Business created by E2E tests',
      address: '1 Test Street',
      phone: '+15550001111',
      website: 'https://e2e.test',
      category: 'software',
    },
  })
  if (!response.ok()) {
    throw new Error(`Business creation failed (${response.status()}): ${await response.text()}`)
  }
  const body = await response.json()
  return { id: body.data.id as string, name: body.data.name as string }
}

export interface TestAccount {
  id: string
}

/** Inserts a connected social account row straight into the dev database. */
export async function createTestAccount(userId: string, businessId: string): Promise<TestAccount> {
  const id = `e2e-${Date.now()}${Math.floor(Math.random() * 1000)}`
  const now = Math.floor(Date.now() / 1000)
  await getDb().execute({
    sql: 'INSERT INTO social_media_accounts (id, user_id, business_id, platform, account_id, account_name, access_token, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    args: [id, userId, businessId, 'twitter', `e2e-${id}`, 'E2E Account', 'e2e-token', now, now],
  })
  return { id }
}

/** Connected Instagram account fixture (the only platform auto-reply can send from). */
export async function createTestInstagramAccount(userId: string, businessId: string): Promise<TestAccount> {
  const id = `e2e-ig-${Date.now()}${Math.floor(Math.random() * 1000)}`
  const now = Math.floor(Date.now() / 1000)
  await getDb().execute({
    sql: 'INSERT INTO social_media_accounts (id, user_id, business_id, platform, account_id, account_name, access_token, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    args: [id, userId, businessId, 'instagram', `e2e-ig-${id}`, 'E2E Instagram', 'e2e-token', now, now],
  })
  return { id }
}

export interface TestPublishedPost {
  postId: string
  platformPostId: string
}

/**
 * A post published through MagicSync on `socialAccountId`. The auto-reply
 * picker lists exactly these rows — never arbitrary native media.
 */
export async function createPublishedPostFixture(
  userId: string,
  businessId: string,
  socialAccountId: string,
  options: { caption?: string, platformPostId?: string, publishedUrl?: string } = {},
): Promise<TestPublishedPost> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const postId = `e2e-post-${suffix}`
  const platformPostId = options.platformPostId ?? `179${suffix}`
  const now = Math.floor(Date.now() / 1000)
  await getDb().execute({
    sql: 'INSERT INTO posts (id, user_id, business_id, content, media_assets, status, target_platforms, scheduled_at, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [postId, userId, businessId, options.caption ?? 'E2E published post', '[]', 'published', '["instagram"]', now, now, now, now],
  })
  await getDb().execute({
    sql: "INSERT INTO platform_posts (id, post_id, social_account_id, platform_post_id, status, publish_detail, published_at, created_at) VALUES (?, ?, ?, ?, 'published', ?, ?, ?)",
    args: [
      `e2e-pp-${suffix}`,
      postId,
      socialAccountId,
      'instagram',
      JSON.stringify({
        [socialAccountId]: {
          publishedId: platformPostId,
          publishedUrl: options.publishedUrl ?? `https://instagram.com/p/${platformPostId}`,
        },
      }),
      now,
      now,
    ],
  })
  return { postId, platformPostId }
}

export interface TestAssets {
  ids: string[]
}

/** Image assets for the media gallery (external placeholder URLs, no upload). */
export async function createTestAssets(
  userId: string,
  businessId: string,
  count = 6,
): Promise<TestAssets> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const now = Math.floor(Date.now() / 1000)
  const ids: string[] = []
  for (let index = 0; index < count; index++) {
    const id = `e2e-asset-${suffix}-${index}`
    ids.push(id)
    await getDb().execute({
      sql: 'INSERT INTO assets (id, user_id, business_id, filename, original_name, mime_type, size, url, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
      args: [
        id,
        userId,
        businessId,
        `asset-${index}.jpg`,
        `E2E asset ${index}`,
        'image/jpeg',
        (index + 1) * 2_000_000,
        `https://picsum.photos/id/${10 + index}/900/${900 + index * 40}`,
        now,
      ],
    })
  }
  return { ids }
}

/**
 * 30 days of account metrics so the dashboard trend chart renders real series
 * (the chart hides itself when there is no history).
 */
export async function createAccountMetrics(
  userId: string,
  businessId: string,
  days = 30,
): Promise<{ accountId: string }> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const accountId = `e2e-metrics-${suffix}`
  const now = Math.floor(Date.now() / 1000)
  await getDb().execute({
    sql: 'INSERT INTO social_media_accounts (id, user_id, business_id, platform, account_id, account_name, access_token, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    args: [accountId, userId, businessId, 'instagram', `e2e-metrics-${accountId}`, 'E2E Metrics', 'e2e-token', now, now],
  })
  for (let index = days - 1; index >= 0; index--) {
    const day = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10)
    await getDb().execute({
      sql: "INSERT INTO account_metrics (id, social_account_id, platform, snapshot_date, followers, following, posts, engagement, source, status, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'success', ?)",
      args: [
        `e2e-metric-${suffix}-${index}`,
        accountId,
        'instagram',
        day,
        1200 + index * 18 + Math.round(120 * Math.sin(index / 3)),
        300,
        40 + index,
        JSON.stringify({ total: Math.round(320 + index * 6 + 80 * Math.sin(index / 4)) }),
        now - index * 86_400,
      ],
    })
  }
  return { accountId }
}

/**
 * Blocks heavyweight external assets (ONNX models from HuggingFace, etc.)
 * that some tools start downloading on mount. The tools degrade to their
 * error/idle states gracefully — pages stay fast and deterministic.
 */
export async function blockHeavyAssets(page: Page): Promise<void> {
  await page.route(/huggingface\.co|hf\.co|cdn-lfs|unsplash\.com/, route => route.abort())
}

/**
 * Waits until Nuxt finishes hydrating so Vue event listeners are attached.
 * Without this, clicks fired right after `goto` are lost silently.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => {
    const w = window as unknown as {
      useNuxtApp?: () => { isHydrating?: boolean }
      __NUXT_HYDRATED__?: boolean
    }
    try {
      if (typeof w.useNuxtApp === 'function') {
        return w.useNuxtApp().isHydrating === false
      }
    }
    catch {
      // app not ready yet
    }
    return w.__NUXT_HYDRATED__ === true
  }, { timeout: 30000 }).catch(async () => {
    // Fallback: give the SPA a moment if the flag isn't exposed
    await page.waitForTimeout(1500)
  })
}
