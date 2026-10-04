import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T100 analytics/templates coverage: scoped reads, template CRUD, and
 * template-to-artifact application through the real Nuxt server.
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

test.describe('Analytics and templates (T100)', () => {
  test('best posts report empty state with version', async () => {
    const res = await authed.get(`/api/v1/business/${business.id}/analytics/best-posts?days=30`)
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()).data as { posts: unknown[], warnings: string[], version: string }
    expect(data.posts).toEqual([])
    expect(data.version).toBe('analytics/v1')
    expect(data.warnings.length).toBeGreaterThan(0)
  })

  test('templates persist and apply into review artifacts', async () => {
    const created = await authed.post('/api/v1/content-templates', {
      data: { businessId: business.id, name: 'Question hook', hookStyle: 'question', structure: ['hook', 'body', 'cta'], toneNotes: 'direct' },
    })
    expect(created.ok()).toBeTruthy()
    const template = (await created.json()).data as { id: string }
    const listed = await authed.get(`/api/v1/content-templates?businessId=${business.id}`)
    expect(((await listed.json()).data as { id: string }[]).some(row => row.id === template.id)).toBe(true)

    const applied = await authed.post(`/api/v1/content-templates/${template.id}/apply`, {
      data: { businessId: business.id, theme: 'Morning routines' },
    })
    expect(applied.ok()).toBeTruthy()
    const { artifactId, caption } = (await applied.json()).data as { artifactId: string, caption: string }
    expect(caption).toContain('Morning routines')
    const artifact = await authed.get(`/api/v1/artifacts/${artifactId}?businessId=${business.id}`)
    expect(((await artifact.json()).data as { status: string }).status).toBe('review_required')
  })
})
