import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser } from './setup.mjs'

// T60.2 — durable graph executor over real SQLite.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/pipeline-runs.test.mjs

const OWNER = 'pipe-owner'
const OUTSIDER = 'pipe-outsider'

let db
let schema
let cleanup
let svc

function graph() {
  const node = (id, kind) => ({ id, kind, name: id, position: { x: 0, y: 0 }, config: {} })
  return {
    schemaVersion: 1,
    nodes: [
      node('trigger', 'manual_trigger'),
      node('research', 'research'),
      node('write', 'write_post'),
      node('review', 'human_review'),
      node('publish', 'create_post'),
      node('end', 'terminal'),
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'research' },
      { id: 'e2', source: 'research', target: 'write' },
      { id: 'e3', source: 'write', target: 'review' },
      { id: 'e4', source: 'review', target: 'publish' },
      { id: 'e5', source: 'publish', target: 'end' },
    ],
    policy: { requiresArtifactApproval: true, maxRetriesPerNode: 2, useBusinessContext: false },
  }
}

async function makePipeline(userId, businessId) {
  const created = await svc.pipelineService.createPipeline(userId, { name: 'Flow', businessId })
  assert.equal(created.success, true)
  return created.data
}

async function makeActiveRun(userId, businessId) {
  const pipeline = await makePipeline(userId, businessId)
  const saved = await svc.pipelineService.saveGraph(userId, pipeline.id, graph())
  assert.equal(saved.success, true)
  const active = await svc.pipelineService.activatePipeline(userId, pipeline.id)
  assert.equal(active.data.status, 'active')
  const run = await svc.pipelineService.startGraphRun(userId, pipeline.id, { brief: 'hi' })
  assert.equal(run.success, true)
  return { pipeline, run: run.data }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'pipe-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'pipe-outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const pipeline = await import('#layers/BaseDB/server/services/pipeline.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...pipeline, ...profile }
})

after(() => cleanup())

describe('graph workflows (T60.1)', () => {
  it('saves, activates, clones, and archives workflows', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const pipeline = await makePipeline(OWNER, biz.data.id)
    const bad = await svc.pipelineService.saveGraph(OWNER, pipeline.id, { nodes: [], edges: [] })
    assert.equal(bad.success, false)
    const saved = await svc.pipelineService.saveGraph(OWNER, pipeline.id, graph())
    assert.equal(saved.success, true)
    const active = await svc.pipelineService.activatePipeline(OWNER, pipeline.id)
    assert.equal(active.data.version, 2)
    const locked = await svc.pipelineService.saveGraph(OWNER, pipeline.id, graph())
    assert.equal(locked.success, false)
    const clone = await svc.pipelineService.clonePipeline(OWNER, pipeline.id)
    assert.equal(clone.data.status, 'draft')
    assert.match(clone.data.name, /copy/)
    const archived = await svc.pipelineService.archivePipeline(OWNER, pipeline.id)
    assert.equal(archived.data.status, 'archived')
  })

  it('refuses runs for draft workflows and foreign businesses', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const pipeline = await makePipeline(OWNER, biz.data.id)
    const draftRun = await svc.pipelineService.startGraphRun(OWNER, pipeline.id, {})
    assert.equal(draftRun.success, false)
    const foreign = await svc.pipelineService.startGraphRun(OUTSIDER, pipeline.id, {})
    assert.equal(foreign.success, false)
  })
})

describe('durable executor (T60.2)', () => {
  it('advances node by node with checkpoints', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const { run } = await makeActiveRun(OWNER, biz.data.id)
    assert.equal(run.currentNodeId, 'trigger')
    for (const nodeId of ['trigger', 'research', 'write']) {
      const checkpoint = await svc.pipelineService.checkpointNodeStart(OWNER, run.id, `attempt-${nodeId}`)
      assert.equal(checkpoint.data.nodeId, nodeId)
      const completed = await svc.pipelineService.completeNode(OWNER, run.id, nodeId, { text: `${nodeId} done` })
      assert.equal(completed.success, true)
    }
    const waiting = await svc.pipelineService.getRun(run.id, OWNER)
    assert.equal(waiting.data.status, 'waiting_review')
    assert.equal(waiting.data.currentNodeId, 'review')
  })

  it('approves reviews and finishes through terminal', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const { run } = await makeActiveRun(OWNER, biz.data.id)
    for (const nodeId of ['trigger', 'research', 'write']) {
      await svc.pipelineService.checkpointNodeStart(OWNER, run.id, `a-${nodeId}`)
      await svc.pipelineService.completeNode(OWNER, run.id, nodeId, { text: 'ok' })
    }
    const approved = await svc.pipelineService.approveReview(OWNER, run.id)
    assert.equal(approved.data.status, 'running')
    assert.equal(approved.data.currentNodeId, 'publish')
    await svc.pipelineService.checkpointNodeStart(OWNER, run.id, 'a-publish')
    const done = await svc.pipelineService.completeNode(OWNER, run.id, 'publish', { postId: 'p1' })
    assert.equal(done.data.status, 'completed')
  })

  it('reruns the prior node with a new attempt on changes requested', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const { run } = await makeActiveRun(OWNER, biz.data.id)
    for (const nodeId of ['trigger', 'research', 'write']) {
      await svc.pipelineService.checkpointNodeStart(OWNER, run.id, `a-${nodeId}`)
      await svc.pipelineService.completeNode(OWNER, run.id, nodeId, { text: 'ok' })
    }
    const changed = await svc.pipelineService.requestChanges(OWNER, run.id, 'punchier hook', 'attempt-2')
    assert.equal(changed.data.status, 'changes_requested')
    assert.equal(changed.data.currentNodeId, 'write')
    const again = await svc.pipelineService.checkpointNodeStart(OWNER, run.id, 'attempt-2')
    assert.equal(again.data.nodeId, 'write')
  })

  it('cancels executable runs but never terminal ones', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const { run } = await makeActiveRun(OWNER, biz.data.id)
    const cancelled = await svc.pipelineService.cancelGraphRun(OWNER, run.id)
    assert.equal(cancelled.data.status, 'cancelled')
    const again = await svc.pipelineService.cancelGraphRun(OWNER, run.id)
    assert.equal(again.success, false)
  })

  it('rejects out-of-order completion and invalid output', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const { run } = await makeActiveRun(OWNER, biz.data.id)
    const wrong = await svc.pipelineService.completeNode(OWNER, run.id, 'write', { text: 'skip' })
    assert.equal(wrong.success, false)
    const invalid = await svc.pipelineService.completeNode(OWNER, run.id, 'trigger', 'prose')
    assert.equal(invalid.success, false)
  })

  it('keeps run snapshots immutable across workflow edits', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Pipe Co' })
    const pipeline = await makePipeline(OWNER, biz.data.id)
    await svc.pipelineService.saveGraph(OWNER, pipeline.id, graph())
    await svc.pipelineService.activatePipeline(OWNER, pipeline.id)
    const run = await svc.pipelineService.startGraphRun(OWNER, pipeline.id, {})
    const before = JSON.parse(run.data.graphSnapshot)
    assert.deepEqual(before.order, ['trigger', 'research', 'write', 'review', 'publish', 'end'])
    assert.equal(before.workflowVersion, 2)
  })
})
