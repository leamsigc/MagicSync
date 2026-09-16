import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, loginWith, waitForHydration, type TestUser, type TestBusiness } from './helpers/e2e-utils'

/**
 * End-to-end coverage for the Digital Home inheritance features:
 * business corpus + brand keys (Phase 1), pipelines + runs + quick
 * actions (Phase 3/5 backend), publishing connections (Phase 5).
 * All calls hit the REAL Nuxt server with a REAL user + business.
 *
 * Auth rides a persistent APIRequestContext cookie jar (the per-test
 * `request` fixture is a fresh jar, so cookies must NOT be passed
 * per-call — they would be silently ignored).
 */

let user: TestUser
let business: TestBusiness
let authed: APIRequestContext
let pipelineId = ''
let runId = ''

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120000)
  authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  user = await createTestUser(authed)
  business = await createActiveBusiness(authed, user)
})

function api(method: 'get' | 'post' | 'put' | 'delete', url: string, data?: unknown) {
  return authed[method](url, { ...(data !== undefined ? { data } : {}) })
}

// Serial: later tests reuse pipelineId/runId created by earlier ones.
test.describe.configure({ mode: 'serial' })

test.describe('Business corpus (Phase 1)', () => {
  test('corpus section upsert then read back', async () => {
    const put = await api('put', `/api/v1/business/${business.id}/corpus`, {
      section: 'voice_guide',
      content: 'Bold, plain-spoken, allergic to hype.',
    })
    expect(put.ok()).toBeTruthy()

    const get = await api('get', `/api/v1/business/${business.id}/corpus`)
    expect(get.ok()).toBeTruthy()
    const sections = (await get.json()).data as Array<{ section: string, content: string }>
    expect(sections.find(s => s.section === 'voice_guide')?.content).toContain('plain-spoken')
  })

  test('brand keys round-trip and context prompt includes them', async () => {
    const put = await api('put', `/api/v1/business/${business.id}/brand-keys`, {
      key: 'author',
      content: 'E2E Author',
    })
    expect(put.ok()).toBeTruthy()

    const context = await api('get', `/api/v1/business/${business.id}/context`)
    expect(context.ok()).toBeTruthy()
    const prompt = (await context.json()).data as string
    expect(prompt).toContain('E2E Author')
    expect(prompt).toContain('plain-spoken')
  })

  test('invalid corpus section is rejected', async () => {
    const put = await api('put', `/api/v1/business/${business.id}/corpus`, {
      section: 'not_a_section',
      content: 'x',
    })
    expect(put.ok()).toBeFalsy()
  })
})

test.describe('Pipelines (Phase 3)', () => {

  test('list seeds the default social_pipeline', async () => {
    const res = await api('get', `/api/v1/pipelines?businessId=${business.id}`)
    expect(res.ok()).toBeTruthy()
    const pipelines = (await res.json()).data as Array<{ id: string, name: string, steps: string }>
    expect(pipelines.length).toBeGreaterThan(0)
    pipelineId = pipelines[0].id
    const steps = JSON.parse(pipelines[0].steps) as Array<{ name: string }>
    expect(steps.map(s => s.name)).toEqual([
      'Research topics',
      'Write post',
      'Humanize',
      'Design HTML',
      'Human review',
    ])
  })

  test('start run, approve, request changes, complete', async () => {
    const started = await api('post', `/api/v1/pipelines/${pipelineId}/runs`, {
      businessId: business.id,
      input: { brief: 'Launch post', useBusinessContext: true },
    })
    expect(started.ok()).toBeTruthy()
    runId = (await started.json()).data.id as string

    const approve = await api('post', `/api/v1/pipelines/runs/${runId}/advance`, {
      approved: true,
      feedback: '',
    })
    expect((await approve.json()).data).toMatchObject({ currentStep: 1, status: 'waiting_input' })

    const changes = await api('post', `/api/v1/pipelines/runs/${runId}/advance`, {
      approved: false,
      feedback: 'Make it punchier',
    })
    const changed = (await changes.json()).data
    expect(changed.status).toBe('waiting_input')
    expect(changed.stepResults).toContain('punchier')

    for (let i = 0; i < 4; i++) {
      await api('post', `/api/v1/pipelines/runs/${runId}/advance`, { approved: true, feedback: '' })
    }
    const done = await api('get', `/api/v1/pipelines/runs/${runId}`)
    expect((await done.json()).data.status).toBe('completed')
  })

  test('runs list includes the finished run', async () => {
    const res = await api('get', `/api/v1/pipelines/runs?businessId=${business.id}`)
    expect(res.ok()).toBeTruthy()
    const runs = (await res.json()).data as Array<{ id: string }>
    expect(runs.map(r => r.id)).toContain(runId)
  })

  test('agent run logging round-trips to oversight', async () => {
    const logged = await api('post', '/api/v1/pipelines/agent-runs', {
      pipelineRunId: runId,
      agentName: 'research-agent',
      tokensUsed: 321,
      summary: 'topics gathered',
    })
    expect(logged.ok()).toBeTruthy()

    const list = await api('get', `/api/v1/pipelines/agent-runs?pipelineRunId=${runId}`)
    const rows = (await list.json()).data as Array<{ agentName: string, tokensUsed: number }>
    expect(rows.find(r => r.agentName === 'research-agent')?.tokensUsed).toBe(321)
  })
})

test.describe('Quick actions + publishing (Phase 5)', () => {
  test('queue quick action creates N draft runs, rejects out-of-range days', async () => {
    const bad = await api('post', '/api/v1/pipelines/quick-actions', {
      businessId: business.id,
      action: 'posts',
      days: 31,
    })
    expect(bad.ok()).toBeFalsy()

    const good = await api('post', '/api/v1/pipelines/quick-actions', {
      businessId: business.id,
      action: 'carousels',
      days: 2,
      theme: 'launch',
    })
    expect(good.ok()).toBeTruthy()
    const runs = (await good.json()).data as Array<{ status: string }>
    expect(runs).toHaveLength(2)
    expect(runs.every(r => r.status === 'running')).toBeTruthy()
  })

  test('publishing connections validate provider and push safely', async () => {
    const bad = await api('post', '/api/v1/publishing', {
      businessId: business.id,
      provider: 'ftp',
      name: 'nope',
      config: {},
      secret: 'x',
    })
    expect(bad.ok()).toBeFalsy()

    const created = await api('post', '/api/v1/publishing', {
      businessId: business.id,
      provider: 'wordpress',
      name: 'E2E blog',
      config: { siteUrl: 'https://e2e.invalid', username: 'e2e' },
      secret: 'not-a-real-secret',
    })
    expect(created.ok()).toBeTruthy()
    const createdBody = (await created.json()).data as { secret: null, hasSecret: boolean }
    expect(createdBody.secret).toBeNull()
    expect(createdBody.hasSecret).toBe(true)

    const listed = await api('get', `/api/v1/publishing/connections?businessId=${business.id}`)
    const connections = (await listed.json()).data as Array<{ secret: null, hasSecret: boolean }>
    expect(connections.every(c => c.secret === null)).toBeTruthy()

    const push = await api('post', '/api/v1/publishing/push', {
      businessId: business.id,
      provider: 'wordpress',
      title: 'E2E post',
      markdown: '# hello',
    })
    // .invalid never resolves: must fail, and must not leak the secret.
    // It must also get past secret decryption (not fail with 'missing password').
    expect(push.ok()).toBeFalsy()
    const pushText = await push.text()
    expect(pushText).not.toContain('not-a-real-secret')
    expect(pushText).not.toContain('missing an application password')
  })
})

test.describe('Pipeline run controls', () => {
  test('pause then resume a running run', async () => {
    const started = await api('post', `/api/v1/pipelines/${pipelineId}/runs`, {
      businessId: business.id,
      input: { brief: 'Pause me', useBusinessContext: false },
    })
    expect(started.ok()).toBeTruthy()
    const id = (await started.json()).data.id as string

    const paused = await api('post', `/api/v1/pipelines/runs/${id}/pause`)
    expect(paused.ok()).toBeTruthy()
    expect((await paused.json()).data.status).toBe('waiting_input')

    const pausedAgain = await api('post', `/api/v1/pipelines/runs/${id}/pause`)
    expect(pausedAgain.ok()).toBeFalsy()

    const resumed = await api('post', `/api/v1/pipelines/runs/${id}/resume`)
    expect(resumed.ok()).toBeTruthy()
    expect((await resumed.json()).data.status).toBe('running')
  })

  test('reset run to an earlier step', async () => {
    const started = await api('post', `/api/v1/pipelines/${pipelineId}/runs`, {
      businessId: business.id,
      input: { brief: 'Reset me', useBusinessContext: false },
    })
    const id = (await started.json()).data.id as string
    await api('post', `/api/v1/pipelines/runs/${id}/advance`, { approved: true, feedback: '' })

    const reset = await api('post', `/api/v1/pipelines/runs/${id}/reset`, { step: 0 })
    expect(reset.ok()).toBeTruthy()
    expect((await reset.json()).data).toMatchObject({ currentStep: 0, status: 'running' })

    const badReset = await api('post', `/api/v1/pipelines/runs/${id}/reset`, { step: -1 })
    expect(badReset.ok()).toBeFalsy()
  })

  test('delete pipeline removes it and its runs', async () => {
    const created = await api('post', '/api/v1/pipelines', {
      businessId: business.id,
      name: 'E2E doomed pipeline',
      steps: [],
    })
    expect(created.ok()).toBeTruthy()
    const doomedId = (await created.json()).data.id as string

    const deleted = await api('delete', `/api/v1/pipelines/${doomedId}`)
    expect(deleted.ok()).toBeTruthy()

    const fetched = await api('get', `/api/v1/pipelines/${doomedId}`)
    expect(fetched.status()).toBe(404)
  })
})

test.describe('On-demand execution', () => {
  test('unknown run returns 404', async () => {
    const res = await api('post', '/api/v1/pipelines/runs/does-not-exist/execute')
    expect(res.status()).toBe(404)
  })

  test('completed run cannot be executed again', async () => {
    const res = await api('post', `/api/v1/pipelines/runs/${runId}/execute`)
    expect(res.status()).toBe(400)
  })
})

test.describe('Pipelines page smoke', () => {
  test('renders the pipelines header', async ({ page }) => {
    await loginWith(page, user)
    await page.goto('/app/pipelines')
    await waitForHydration(page)
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('Pipeline studio', () => {
  async function createStudioPipeline(name: string, steps: unknown[]) {
    const created = await api('post', '/api/v1/pipelines', {
      businessId: business.id,
      name,
      steps,
    })
    expect(created.ok()).toBeTruthy()
    return (await created.json()).data.id as string
  }

  test('studio renders palette and canvas', async ({ page }) => {
    const pipelineId = await createStudioPipeline('Studio E2E', [])

    await loginWith(page, user)
    await page.goto(`/app/pipelines/studio?pipeline=${pipelineId}`)
    await waitForHydration(page)
    await expect(page.getByTestId('studio-palette')).toBeVisible()
    await expect(page.getByTestId('studio-canvas')).toBeVisible()
    // Empty pipelines start with the manual trigger anchor
    await expect(page.getByTestId('node-count')).toHaveText('1')
  })

  test('add node + connect + save persists', async ({ page }) => {
    const pipelineId = await createStudioPipeline('Studio E2E Flow', [])

    await loginWith(page, user)
    await page.goto(`/app/pipelines/studio?pipeline=${pipelineId}`)
    await waitForHydration(page)
    await expect(page.getByTestId('node-count')).toHaveText('1')

    await page.getByTestId('palette-add-writer').click()
    await expect(page.getByTestId('node-count')).toHaveText('2')
    await expect(page.getByTestId('edge-count')).toHaveText('1')

    await page.getByTestId('studio-save').click()
    await expect(page.getByText('Pipeline saved', { exact: true })).toBeVisible()

    const res = await api('get', `/api/v1/pipelines/${pipelineId}`)
    expect(res.ok()).toBeTruthy()
    const steps = JSON.parse((await res.json()).data.steps) as Array<{ kind?: string, name: string }>
    expect(steps.map(step => step.kind)).toContain('writer')
  })

  test('invalid graph without trigger blocks save with toast', async ({ page }) => {
    const pipelineId = await createStudioPipeline('Studio E2E Invalid', [
      { id: 'w1', name: 'Write post', type: 'llm_single', prompt: 'draft', kind: 'writer' },
    ])
    const before = await api('get', `/api/v1/pipelines/${pipelineId}`)
    const stepsBefore = (await before.json()).data.steps as string

    await loginWith(page, user)
    await page.goto(`/app/pipelines/studio?pipeline=${pipelineId}`)
    await waitForHydration(page)
    // Stored writer step plus the auto-added trigger anchor
    await expect(page.getByTestId('node-count')).toHaveText('2')

    await page.locator('[data-testid="studio-node"]').first().click()
    await expect(page.getByTestId('node-inspector')).toBeVisible()
    await expect(page.getByTestId('node-name')).toHaveValue('Manual trigger')
    await page.getByTestId('node-delete').click()
    await expect(page.getByTestId('node-count')).toHaveText('1')

    await page.getByTestId('studio-save').click()
    await expect(page.getByTestId('studio-validation')).toHaveText('Add exactly one manual trigger to start the pipeline.')
    await expect(page.locator('div[data-slot="title"]', { hasText: 'Add exactly one manual trigger to start the pipeline.' })).toBeVisible()

    const after = await api('get', `/api/v1/pipelines/${pipelineId}`)
    expect((await after.json()).data.steps as string).toBe(stepsBefore)
  })
})

test.describe('AI model settings (account + override)', () => {
  const overrideSecret = `e2e-llm-${Date.now()}-secret`

  test('providers list exposes 6 providers', async () => {
    const res = await api('get', '/api/v1/llm/providers')
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { providers: Array<{ provider: string }> }
    expect(body.providers.map(p => p.provider).sort()).toEqual([
      'anthropic',
      'deepseek',
      'google',
      'ollama',
      'openai',
      'openrouter',
    ])
  })

  test('override save works and key is never echoed in GET', async () => {
    const saved = await api('post', '/api/v1/llm/override', {
      businessId: business.id,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: overrideSecret,
    })
    expect(saved.ok()).toBeTruthy()
    const savedBody = await saved.json() as { apiKey: null, hasKey: boolean }
    expect(savedBody.apiKey).toBeNull()
    expect(savedBody.hasKey).toBe(true)

    const fetched = await api('get', `/api/v1/llm/override?businessId=${business.id}`)
    expect(fetched.ok()).toBeTruthy()
    const fetchedText = await fetched.text()
    expect(fetchedText).not.toContain(overrideSecret)
    const fetchedBody = JSON.parse(fetchedText) as { apiKey: null, hasKey: boolean }
    expect(fetchedBody.apiKey).toBeNull()
    expect(fetchedBody.hasKey).toBe(true)

    const listed = await api('get', '/api/ai-tools/llm')
    expect(listed.ok()).toBeTruthy()
    expect(await listed.text()).not.toContain(overrideSecret)
  })

  test('effective resolves to the override', async () => {
    const res = await api('get', `/api/v1/llm/effective?businessId=${business.id}`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json() as { provider: string, model: string, apiKey: null }
    expect(data.provider).toBe('openai')
    expect(data.model).toBe('gpt-4o-mini')
    expect(data.apiKey).toBeNull()
  })

  test('account AI tab renders', async ({ page }) => {
    await loginWith(page, user)
    await page.goto('/app/account')
    await waitForHydration(page)
    await expect(page.getByText('AI Model').first()).toBeVisible()
  })
})

test.describe('Brand questionnaire + refine', () => {
  test('refine validates empty answers', async () => {
    const res = await api('post', `/api/v1/business/${business.id}/playbook/refine`, {
      answers: [],
    })
    expect(res.ok()).toBeFalsy()
  })

  test('refine on unknown business is 404', async () => {
    const res = await api('post', '/api/v1/business/does-not-exist/playbook/refine', {
      answers: [{ section: 'voice', question: 'Q?', answer: 'Bold' }],
    })
    expect(res.status()).toBe(404)
  })

  test('answer → refine (mocked AI) → apply saves draft', async ({ page }) => {
    await loginWith(page, user)
    await page.route('**/playbook/refine', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playbook: {
            version: 1,
            businessName: 'E2E Quiz Biz',
            voice: { tone: 'Bold', bannedPhrases: [], influences: [] },
          },
        }),
      })
    })
    await page.goto(`/app/business/${business.id}/playbook`)
    await waitForHydration(page)
    await page.getByRole('button', { name: /answer questions/i }).click()
    await page.locator('textarea').first().fill('We sound bold and direct')
    await page.getByRole('button', { name: /refine with ai/i }).click()
    await expect(page.locator('h3', { hasText: /refined playbook ready/i })).toBeVisible()
    await page.getByRole('button', { name: /apply to draft/i }).click()
    await expect(page.getByText(/draft saved|saved/i).first()).toBeVisible({ timeout: 15000 })
  })
})
