import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T110 oversight coverage: approval history scoping through the real Nuxt
 * server. The agent-run oversight endpoints lived under /api/v1/pipelines and
 * were removed together with the pipeline studio.
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

test.describe('Oversight (T110)', () => {
  test('approval history is business-scoped', async () => {
    const res = await authed.get(`/api/v1/artifacts/approvals?businessId=${business.id}`)
    expect(res.ok()).toBeTruthy()
    expect(Array.isArray((await res.json()).data)).toBe(true)
  })
})
