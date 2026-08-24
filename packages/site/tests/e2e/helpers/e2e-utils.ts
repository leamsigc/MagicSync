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
