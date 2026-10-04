import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, type TestBusiness } from './helpers/e2e-utils'

/**
 * T40 registry coverage: built-in seeding, skill/agent lifecycle, and
 * version snapshots through the real Nuxt server.
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

test.describe('Skill/agent registry (T40)', () => {
  test('seeds built-ins idempotently', async () => {
    const first = await authed.post('/api/v1/agents/seed', { data: { businessId: business.id } })
    expect(first.ok()).toBeTruthy()
    const seeded = (await first.json()).data as { agents: number, skills: number }
    expect(seeded.agents).toBeGreaterThanOrEqual(5)
    const second = await authed.post('/api/v1/agents/seed', { data: { businessId: business.id } })
    expect(((await second.json()).data as { agents: number }).agents).toBe(0)
  })

  test('skill lifecycle with version snapshots', async () => {
    const created = await authed.post('/api/v1/skills', {
      data: { businessId: business.id, name: 'E2E Skill', slug: 'e2e-skill', instructions: 'Do research.', allowedTools: ['web_search'] },
    })
    expect(created.ok()).toBeTruthy()
    const skill = (await created.json()).data as { id: string, status: string }
    expect(skill.status).toBe('draft')

    const badTool = await authed.post('/api/v1/skills', {
      data: { businessId: business.id, name: 'Bad', slug: 'bad-skill', allowedTools: ['execute_code'] },
    })
    expect(badTool.ok()).toBeFalsy()

    const published = await authed.post(`/api/v1/skills/${skill.id}/publish?businessId=${business.id}`)
    expect(published.ok()).toBeTruthy()
    expect(((await published.json()).data as { status: string }).status).toBe('active')
  })

  test('agent references pinned skill versions', async () => {
    const skill = await authed.post('/api/v1/skills', {
      data: { businessId: business.id, name: 'Ref Skill', slug: 'ref-skill', allowedTools: ['retrieve'] },
    })
    const skillId = ((await skill.json()).data as { id: string }).id
    const agent = await authed.post('/api/v1/agents', {
      data: {
        businessId: business.id,
        name: 'E2E Writer',
        systemPrompt: 'Write.',
        skillVersionIds: [`${skillId}@1`],
        allowedToolNames: ['generate_social_post'],
        outputKind: 'social_post_draft',
      },
    })
    expect(agent.ok()).toBeTruthy()
    const agentId = ((await agent.json()).data as { id: string }).id
    const published = await authed.post(`/api/v1/agents/${agentId}/publish?businessId=${business.id}`)
    expect(published.ok()).toBeTruthy()

    const unknown = await authed.post('/api/v1/agents', {
      data: { businessId: business.id, name: 'Bad Agent', skillVersionIds: ['missing@1'] },
    })
    expect(unknown.ok()).toBeFalsy()
  })
})
