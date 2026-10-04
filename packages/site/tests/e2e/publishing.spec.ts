import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T120 publishing coverage: connection validation, approval-gated jobs,
 * and idempotent duplicates through the real Nuxt server.
 */

let authed: APIRequestContext
let business: TestBusiness

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120000)
  authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const owner = await createTestUser(authed)
  business = await createActiveBusiness(authed, owner)
})

test.describe.configure({ mode: 'serial' })

test.describe('Publishing (T120)', () => {
  test('rejects mismatched delivery modes', async () => {
    const res = await authed.post('/api/v1/publishing/connections', {
      data: { businessId: business.id, provider: 'github', name: 'Bad', config: { repo: 'a/b' }, deliveryMode: 'live' },
    })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(400)
  })

  test('jobs require exact-version approval and dedupe by key', async () => {
    const connection = await authed.post('/api/v1/publishing/connections', {
      data: { businessId: business.id, provider: 'github', name: 'Docs', config: { repo: 'acme/docs' }, secret: 'token' },
    })
    expect(connection.ok()).toBeTruthy()
    const connectionId = ((await connection.json()).data as { id: string }).id

    const submitted = await authed.post('/api/v1/artifacts', {
      data: {
        businessId: business.id, kind: 'social_post', outputKind: 'social_post_draft',
        output: { outputKind: 'social_post_draft', caption: 'Ship it', platformVariants: {}, slideCopy: [], cta: '', claims: [], sources: [] },
      },
    })
    const artifact = (await submitted.json()).data as { id: string }

    const unapproved = await authed.post('/api/v1/publishing/jobs', {
      data: { businessId: business.id, connectionId, artifactId: artifact.id, artifactVersion: 1 },
    })
    expect(unapproved.ok()).toBeFalsy()

    await authed.post(`/api/v1/artifacts/${artifact.id}/review?businessId=${business.id}`, {
      data: { decision: 'approved', feedback: '', version: 1 },
    })
    const first = await authed.post('/api/v1/publishing/jobs', {
      data: { businessId: business.id, connectionId, artifactId: artifact.id, artifactVersion: 1 },
    })
    expect(first.ok()).toBeTruthy()
    expect(((await first.json()).data as { duplicate: boolean }).duplicate).toBe(false)
    const second = await authed.post('/api/v1/publishing/jobs', {
      data: { businessId: business.id, connectionId, artifactId: artifact.id, artifactVersion: 1 },
    })
    expect(((await second.json()).data as { duplicate: boolean }).duplicate).toBe(true)

    const jobs = await authed.get(`/api/v1/publishing/jobs?businessId=${business.id}`)
    expect(jobs.ok()).toBeTruthy()
    expect(((await jobs.json()).data as unknown[]).length).toBeGreaterThan(0)
  })
})
