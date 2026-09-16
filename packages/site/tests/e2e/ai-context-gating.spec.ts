import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T20.3 gating coverage for the shared business-context contract:
 * every MagicSync-managed AI path resolves context through one resolver,
 * fails loudly when requested context cannot load, and proceeds ungrounded
 * otherwise — all without requiring a live LLM.
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

test.describe('AI context gating (T20)', () => {
  test('social route rejects enabled context without a business', async () => {
    const res = await authed.post('/api/ai-tools/social-media/generate-hooks', {
      data: { topic: 'launch', platform: 'twitter', useBusinessContext: true },
    })
    expect(res.status()).toBe(400)
  })

  test('social route hides foreign businesses', async () => {
    const res = await authed.post('/api/ai-tools/social-media/generate-hooks', {
      data: { topic: 'launch', platform: 'twitter', businessId: 'no-such-business', useBusinessContext: true },
    })
    expect(res.status()).toBe(404)
  })

  test('social route blocks branded calls without a current playbook', async () => {
    const res = await authed.post('/api/ai-tools/social-media/generate-hooks', {
      data: { topic: 'launch', platform: 'twitter', businessId: business.id, useBusinessContext: true },
    })
    expect(res.status()).toBe(400)
    const body = await res.json() as { message?: string, statusMessage?: string }
    expect(`${body.message ?? ''}${body.statusMessage ?? ''}`).toMatch(/Playbook/i)
  })

  test('streaming chat blocks branded calls without a current playbook', async () => {
    const res = await authed.post('/api/v1/agent/chat', {
      data: { businessId: business.id, message: 'Hello' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json() as { message?: string, statusMessage?: string }
    expect(`${body.message ?? ''}${body.statusMessage ?? ''}`).toMatch(/Playbook/i)
  })

  test('streaming chat hides foreign businesses', async () => {
    const res = await authed.post('/api/v1/agent/chat', {
      data: { businessId: 'no-such-business', message: 'Hello' },
    })
    expect(res.status()).toBe(404)
  })
})
