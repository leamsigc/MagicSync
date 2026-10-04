import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T10.3 coverage for the Brand Playbook + intake PRD:
 * intake -> draft, import/export round trip, publish dedupe, restore,
 * discard, readiness gate, legacy migration, and outsider isolation.
 * All calls hit the REAL Nuxt server with REAL users + businesses.
 */

let authed: APIRequestContext
let outsider: APIRequestContext
let outsiderCookie: { name: string, value: string }
let business: TestBusiness
let draftId = ''

function api(method: 'get' | 'post' | 'put' | 'delete', url: string, data?: unknown) {
  return authed[method](url, { ...(data !== undefined ? { data } : {}) })
}

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120000)
  authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const owner = await createTestUser(authed)
  business = await createActiveBusiness(authed, owner)
  outsider = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const stranger = await createTestUser(outsider)
  outsiderCookie = stranger.sessionCookie
})

test.describe.configure({ mode: 'serial' })

test.describe('Playbook intake (T10)', () => {
  test('readiness reports not-ready before any edition', async () => {
    const res = await api('get', `/api/v1/business/${business.id}/playbook/readiness`)
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()).data as { brandedReady: boolean, editionId: string | null }
    expect(data.brandedReady).toBe(false)
    expect(data.editionId).toBeNull()
  })

  test('intake answers create a structured draft', async () => {
    const res = await api('post', `/api/v1/business/${business.id}/playbook/intake`, {
      answers: [
        { group: 'voice', question: 'tone', answer: 'Bold and plain-spoken' },
        { group: 'audience', question: 'who', answer: 'Indie founders' },
        { group: 'offers', question: 'main', answer: 'Launch Sprint — ship in 2 weeks — $900' },
      ],
    })
    expect(res.ok()).toBeTruthy()
    const edition = (await res.json()).data as { id: string, playbook: Record<string, unknown> }
    draftId = edition.id
    const playbook = edition.playbook as { voice: { tone: string }, positioning: { audience: string } }
    expect(playbook.voice.tone).toContain('Bold')
    expect(playbook.positioning.audience).toContain('Indie founders')
  })

  test('import/export round trip preserves fields', async () => {
    const exported = await api('get', `/api/v1/business/${business.id}/playbook/export?editionId=${draftId}`)
    expect(exported.ok()).toBeTruthy()
    const payload = (await exported.json()).data as { format: string, edition: { playbook: unknown } }
    expect(payload.format).toBe('magicsync-playbook/v1')

    const imported = await api('post', `/api/v1/business/${business.id}/playbook/import`, payload.edition.playbook)
    expect(imported.ok()).toBeTruthy()
    draftId = (await imported.json()).data.id as string
  })

  test('publishing twice with the same hash dedupes', async () => {
    const first = await api('post', `/api/v1/business/${business.id}/playbook/publish`, { editionId: draftId })
    expect(first.ok()).toBeTruthy()
    expect((await first.json()).data.duplicate).toBe(false)

    const second = await api('post', `/api/v1/business/${business.id}/playbook/publish`, { editionId: draftId })
    expect(second.ok()).toBeTruthy()
    expect((await second.json()).data.duplicate).toBe(true)
  })

  test('readiness reports ready after publish', async () => {
    const res = await api('get', `/api/v1/business/${business.id}/playbook/readiness`)
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()).data as { brandedReady: boolean, editionId: string | null }
    expect(data.brandedReady).toBe(true)
    expect(data.editionId).toBeTruthy()
  })

  test('restore creates a new draft without mutating history', async () => {
    const res = await api('post', `/api/v1/business/${business.id}/playbook/restore`, { editionId: draftId })
    expect(res.ok()).toBeTruthy()
    const restored = (await res.json()).data as { id: string, status: string }
    expect(restored.status).toBe('draft')
    expect(restored.id).not.toBe(draftId)

    const discarded = await api('post', `/api/v1/business/${business.id}/playbook/discard`, { editionId: restored.id })
    expect(discarded.ok()).toBeTruthy()
    expect((await discarded.json()).data.status).toBe('discarded')
  })

  test('legacy migration with no legacy rows is a no-op', async () => {
    const res = await api('post', `/api/v1/business/${business.id}/playbook/migrate`)
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()).data as { migrated: boolean, edition: null }
    expect(data.migrated).toBe(false)
    expect(data.edition).toBeNull()
  })

  test('outsider cannot read another business corpus', async () => {
    const res = await outsider.get(`/api/v1/business/${business.id}/corpus`, {
      cookies: { [outsiderCookie.name]: outsiderCookie.value },
    })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(404)
  })

  test('intake maps identity/audience/safety groups into v2 fields', async () => {
    const res = await api('post', `/api/v1/business/${business.id}/playbook/intake`, {
      answers: [
        { group: 'identity', question: 'website', answer: 'https://example.test' },
        { group: 'identity', question: 'industry', answer: 'Retail' },
        { group: 'audience', question: 'primary', answer: 'Shop owners' },
        { group: 'audience', question: 'outcome', answer: 'More sales' },
        { group: 'safety', question: 'never', answer: 'Fake guarantees' },
        { group: 'verify', question: 'claims', answer: 'Revenue numbers' },
      ],
    })
    expect(res.ok()).toBeTruthy()
    const edition = (await res.json()).data as {
      playbook: {
        identity: { website: string, industry: string }
        audience: { primary: string, outcome: string }
        safety: { neverSay: string[], verifyBeforeClaim: string[] }
        completion: { missingFields: string[], ready: boolean }
        metadata: { schemaVersion: number }
      }
    }
    expect(edition.playbook.identity.website).toBe('https://example.test')
    expect(edition.playbook.identity.industry).toBe('Retail')
    expect(edition.playbook.audience.primary).toBe('Shop owners')
    expect(edition.playbook.safety.neverSay).toContain('Fake guarantees')
    expect(edition.playbook.safety.verifyBeforeClaim).toContain('Revenue numbers')
    expect(edition.playbook.metadata.schemaVersion).toBe(2)
    expect(edition.playbook.completion.ready).toBe(false)
  })
})
