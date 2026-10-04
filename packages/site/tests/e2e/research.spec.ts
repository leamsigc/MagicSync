import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T50 research coverage: contract validation and structured SSRF failures
 * through the real Nuxt server (no live fetching required).
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

test.describe('Research ingestion (T50)', () => {
  test('rejects invalid research input', async () => {
    const empty = await authed.post('/api/v1/research/run', { data: { businessId: business.id, brief: '' } })
    expect(empty.ok()).toBeFalsy()
    const many = await authed.post('/api/v1/research/run', {
      data: { businessId: business.id, brief: 'x', referenceUrls: Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`) },
    })
    expect(many.ok()).toBeFalsy()
  })

  test('blocked urls become structured warnings', async () => {
    const res = await authed.post('/api/v1/research/run', {
      data: { businessId: business.id, brief: 'local trends', referenceUrls: ['http://127.0.0.1/admin'] },
    })
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()) as { sources: unknown[], warnings: string[], researchId: string }
    expect(data.sources).toEqual([])
    expect(data.warnings.some(warning => warning.includes('Blocked URL'))).toBe(true)
    expect(data.researchId).toMatch(/^res-/)
  })
})
