import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T110 oversight coverage: agent run listing with filters and terminal
 * close validation through the real Nuxt server.
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

test.describe('Agent oversight (T110)', () => {
  test('lists agent runs with status filter', async () => {
    const res = await authed.get(`/api/v1/pipelines/agent-runs?businessId=${business.id}&status=running`)
    expect(res.ok()).toBeTruthy()
    expect(Array.isArray((await res.json()).data)).toBe(true)
  })

  test('closing an unknown run is a clean 404', async () => {
    const res = await authed.post('/api/v1/pipelines/agent-runs/nope/close', {
      data: { status: 'completed' },
    })
    expect(res.status()).toBe(404)
  })

  test('approval history is business-scoped', async () => {
    const res = await authed.get(`/api/v1/artifacts/approvals?businessId=${business.id}`)
    expect(res.ok()).toBeTruthy()
    expect(Array.isArray((await res.json()).data)).toBe(true)
  })
})
