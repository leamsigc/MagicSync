import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, createTestAccount, type TestBusiness } from './helpers/e2e-utils'

/**
 * T70/T80 artifact coverage: submit, review, materialize, schedule, and
 * tenant isolation through the real Nuxt server.
 */

let authed: APIRequestContext
let outsider: APIRequestContext
let outsiderCookie: { name: string, value: string }
let business: TestBusiness

const DRAFT = {
  outputKind: 'social_post_draft',
  caption: 'Hello from e2e',
  platformVariants: {},
  slideCopy: [],
  cta: '',
  claims: [],
  sources: [],
}

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120000)
  authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const owner = await createTestUser(authed)
  business = await createActiveBusiness(authed, owner)
  await createTestAccount(owner.id, business.id)
  outsider = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const stranger = await createTestUser(outsider)
  outsiderCookie = stranger.sessionCookie
})

test.describe.configure({ mode: 'serial' })

test.describe('Content artifacts (T70/T80)', () => {
  test('submit, approve, materialize, and schedule a post artifact', async () => {
    const submitted = await authed.post('/api/v1/artifacts', {
      data: { businessId: business.id, kind: 'social_post', outputKind: 'social_post_draft', output: DRAFT },
    })
    expect(submitted.ok()).toBeTruthy()
    const artifact = (await submitted.json()).data as { id: string, status: string, version: number }
    expect(artifact.status).toBe('review_required')

    const stale = await authed.post(`/api/v1/artifacts/${artifact.id}/review?businessId=${business.id}`, {
      data: { decision: 'approved', feedback: '', version: 99 },
    })
    expect(stale.ok()).toBeFalsy()

    const approved = await authed.post(`/api/v1/artifacts/${artifact.id}/review?businessId=${business.id}`, {
      data: { decision: 'approved', feedback: '', version: 1 },
    })
    expect(approved.ok()).toBeTruthy()

    const materialized = await authed.post(`/api/v1/artifacts/${artifact.id}/materialize?businessId=${business.id}`)
    expect(materialized.ok()).toBeTruthy()
    const first = (await materialized.json()).data as { postId: string, duplicate: boolean }
    expect(first.duplicate).toBe(false)

    const again = await authed.post(`/api/v1/artifacts/${artifact.id}/materialize?businessId=${business.id}`)
    expect(((await again.json()).data as { duplicate: boolean }).duplicate).toBe(true)

    const scheduled = await authed.post(`/api/v1/artifacts/${artifact.id}/schedule?businessId=${business.id}`, {
      data: { scheduledAt: new Date(Date.now() + 86400000).toISOString() },
    })
    expect(scheduled.ok()).toBeTruthy()
  })

  test('outsiders cannot read or review artifacts', async () => {
    const submitted = await authed.post('/api/v1/artifacts', {
      data: { businessId: business.id, kind: 'social_post', outputKind: 'social_post_draft', output: DRAFT },
    })
    const artifact = (await submitted.json()).data as { id: string }
    const res = await outsider.get(`/api/v1/artifacts/${artifact.id}?businessId=${business.id}`, {
      cookies: { [outsiderCookie.name]: outsiderCookie.value },
    })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(404)
  })
})
