import { test, expect, type APIRequestContext } from '@playwright/test'
import { createTestUser, createActiveBusiness, createTestAccount, type TestBusiness } from './helpers/e2e-utils'

/**
 * T60 workflow coverage: graph validation, activation, cloning, and a full
 * no-LLM run (trigger -> review -> approved create_post) on the real server.
 */

let authed: APIRequestContext
let business: TestBusiness

function graph() {
  const node = (id: string, kind: string, config: Record<string, unknown> = {}) => ({
    id, kind, name: id, position: { x: 0, y: 0 }, config,
  })
  return {
    schemaVersion: 1,
    nodes: [
      node('trigger', 'manual_trigger'),
      node('review', 'human_review'),
      node('publish', 'create_post', { content: 'Hello from the run' }),
      node('end', 'terminal'),
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'review' },
      { id: 'e2', source: 'review', target: 'publish' },
      { id: 'e3', source: 'publish', target: 'end' },
    ],
    policy: { requiresArtifactApproval: true, maxRetriesPerNode: 2, useBusinessContext: false },
  }
}

async function createPipeline() {
  const res = await authed.post('/api/v1/pipelines', {
    data: { businessId: business.id, name: 'E2E Flow', steps: [] },
  })
  expect(res.ok()).toBeTruthy()
  return ((await res.json()).data as { id: string }).id
}

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120000)
  authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const owner = await createTestUser(authed)
  business = await createActiveBusiness(authed, owner)
  await createTestAccount(owner.id, business.id)
})

test.describe.configure({ mode: 'serial' })

test.describe('Graph workflows (T60)', () => {
  test('rejects invalid graphs and draft runs', async () => {
    const pipelineId = await createPipeline()
    const bad = await authed.put(`/api/v1/pipelines/${pipelineId}/graph`, { data: { graph: { nodes: [], edges: [] } } })
    expect(bad.ok()).toBeFalsy()
    const activate = await authed.post(`/api/v1/pipelines/${pipelineId}/activate`)
    expect(activate.ok()).toBeFalsy()
    const run = await authed.post('/api/v1/pipelines/runs/start-graph', {
      data: { pipelineId, input: {} },
    })
    expect(run.ok()).toBeFalsy()
  })

  test('clones workflows as drafts', async () => {
    const pipelineId = await createPipeline()
    await authed.put(`/api/v1/pipelines/${pipelineId}/graph`, { data: { graph: graph() } })
    const clone = await authed.post(`/api/v1/pipelines/${pipelineId}/clone`)
    expect(clone.ok()).toBeTruthy()
    const copy = (await clone.json()).data as { status: string, name: string }
    expect(copy.status).toBe('draft')
    expect(copy.name).toContain('copy')
  })

  test('runs trigger, review, and materialization end to end', async () => {
    const pipelineId = await createPipeline()
    await authed.put(`/api/v1/pipelines/${pipelineId}/graph`, { data: { graph: graph() } })
    await authed.post(`/api/v1/pipelines/${pipelineId}/activate`)
    const started = await authed.post('/api/v1/pipelines/runs/start-graph', {
      data: { pipelineId, input: { brief: 'hello' } },
    })
    expect(started.ok()).toBeTruthy()
    const runId = ((await started.json()).data as { id: string }).id

    const trigger = await authed.post(`/api/v1/pipelines/runs/${runId}/node`)
    expect(trigger.ok()).toBeTruthy()
    expect(((await trigger.json()).data as { currentNodeId: string }).currentNodeId).toBe('review')

    const approve = await authed.post(`/api/v1/pipelines/runs/${runId}/approve`)
    expect(approve.ok()).toBeTruthy()
    const publish = await authed.post(`/api/v1/pipelines/runs/${runId}/node`)
    expect(publish.ok()).toBeTruthy()
    const done = (await publish.json()).data as { status: string, currentNodeId: string }
    expect(done.status).toBe('completed')
    expect(done.currentNodeId).toBe('end')
  })
})
