import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'
import { writeStubModelsConfig } from './stub-models.mjs'
import { applyRunApiKey, createAgentComplete, createAgentModelRuntime, resolveRunModel } from '../server/utils/pi-runtime.ts'

const OWNER = 'workflow-owner'
const BUSINESS = 'workflow-business'

let db
let schema
let cleanup
let contentBoardService
let agentWorkflowService

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'workflow@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Workflow Co' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ agentWorkflowService } = await import('../server/services/agent-workflow.service.ts'))
})

after(() => cleanup())

describe('topic batch pipeline (research → trend scan → ideas)', () => {
  let batchStub
  let batchDir
  let batchRuntime

  before(async () => {
    batchStub = await startStubProvider({
      toolScript: [
        { name: 'web_search', args: { query: 'March launch' } },
        { name: 'scan_trends', args: {} },
        { name: 'board_add_cards', args: { cards: [{ title: 'Launch hook', brief: 'Viral angle', platforms: ['twitter'] }, { title: 'Launch story', brief: 'Engagement angle', platforms: ['twitter'] }], sourceType: 'trend' } },
      ],
      finalText: '{"brief": "Test brief: March launch beats expectations with early-bird pricing.", "citations": [{"label": "Test Source", "url": "https://example.com/launch"}]}',
    })
    batchDir = mkdtempSync(join(tmpdir(), 'agent-batch-'))
    batchRuntime = await createAgentModelRuntime({ modelsPath: writeStubModelsConfig(batchDir, batchStub.url) })
    await applyRunApiKey(batchRuntime, 'stub', 'stub-key')
  })

  after(async () => {
    await batchStub.close()
    rmSync(batchDir, { recursive: true, force: true })
  })

  it('researches the topic, scans trends, and records platform-tailored cards', async () => {
    const { agentRunService } = await import('../server/services/agent-run.service.ts')
    const model = resolveRunModel(batchRuntime, 'stub', 'stub-model')
    assert.ok(model, 'stub model resolves')
    const started = await agentRunService.start(OWNER, { businessId: BUSINESS, agentName: 'topic-batch:days' })
    assert.equal(started.success, true)

    await agentWorkflowService.executeTopicBatch({
      userId: OWNER,
      businessId: BUSINESS,
      kind: 'days',
      platforms: ['twitter'],
      topic: 'March launch',
      runId: started.data.id,
      count: 2,
      run: {
        runtime: batchRuntime,
        model,
        provider: 'stub',
        modelId: 'stub-model',
        apiKey: 'stub-key',
        apiBaseUrl: null,
        systemContext: 'test context',
        complete: createAgentComplete(batchRuntime, model),
      },
    })

    const finished = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, started.data.id))
    assert.equal(finished[0].status, 'completed')
    assert.match(finished[0].summary, /idea cards/)
    assert.match(finished[0].summary, /March launch/)
    assert.match(finished[0].summary, /research agent/)

    const board = await contentBoardService.list(OWNER, BUSINESS, { state: 'idea' })
    assert.ok(board.data.some(card => card.title === 'Launch hook' && card.sourceType === 'trend'))
    assert.ok(board.data.some(card => card.platforms?.includes('twitter')))

    const batchRuns = await db.select().from(schema.contentRuns).where(eq(schema.contentRuns.step, 'batch:days'))
    assert.ok(batchRuns.length >= 2)
    assert.ok(batchRuns.every(run => run.status === 'completed'))

    const prompted = batchStub.requests.map(request => JSON.stringify(request)).join('\n')
    assert.ok(prompted.includes('280 chars'), 'twitter virality rules reach the model')
    assert.ok(prompted.includes('March launch'))
  })

  it('merges scout cards with plugin ideas without duplicating either', async () => {
    const { agentRunService } = await import('../server/services/agent-run.service.ts')
    const mixedBusiness = 'workflow-business-mixed'
    await insertBusiness(db, { id: mixedBusiness, userId: OWNER, name: 'Mixed Co' })
    const mixedStub = await startStubProvider({
      toolScript: [
        { name: 'web_search', args: { query: 'Mixed topic' } },
        { name: 'scan_trends', args: {} },
        { name: 'board_add_cards', args: { cards: [{ title: 'Mixed hook', brief: 'Scout angle', platforms: ['twitter'] }], sourceType: 'trend' } },
      ],
      finalText: '{"brief": "First verifiable sentence here yes. Second verifiable sentence here yes.", "citations": []}',
    })
    const mixedDir = mkdtempSync(join(tmpdir(), 'agent-batch-mixed-'))
    try {
      const mixedRuntime = await createAgentModelRuntime({ modelsPath: writeStubModelsConfig(mixedDir, mixedStub.url) })
      await applyRunApiKey(mixedRuntime, 'stub', 'stub-key')
      const model = resolveRunModel(mixedRuntime, 'stub', 'stub-model')
      const started = await agentRunService.start(OWNER, { businessId: mixedBusiness, agentName: 'topic-batch:days' })

      await agentWorkflowService.executeTopicBatch({
        userId: OWNER,
        businessId: mixedBusiness,
        kind: 'days',
        platforms: ['twitter'],
        topic: 'Mixed topic',
        runId: started.data.id,
        count: 3,
        run: {
          runtime: mixedRuntime,
          model,
          provider: 'stub',
          modelId: 'stub-model',
          apiKey: 'stub-key',
          apiBaseUrl: null,
          systemContext: 'test context',
          complete: createAgentComplete(mixedRuntime, model),
        },
      })

      const finished = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, started.data.id))
      assert.equal(finished[0].status, 'completed')
      assert.match(finished[0].summary, /3 idea cards/)
      assert.match(finished[0].summary, /trend-scout\+brief-derived/)

      const board = await contentBoardService.list(OWNER, mixedBusiness, { state: 'idea' })
      assert.equal(board.data.length, 3, 'scout cards recorded once, plugin cards inserted once')
      assert.ok(board.data.some(card => card.title === 'Mixed hook' && card.sourceType === 'trend'))
      assert.ok(board.data.some(card => card.brief.includes('Mixed topic')), 'plugin-derived card persisted')
    } finally {
      await mixedStub.close()
      rmSync(mixedDir, { recursive: true, force: true })
    }
  })

  it('falls back to brief-derived ideas when the scout yields nothing', async () => {
    const { agentRunService } = await import('../server/services/agent-run.service.ts')
    const emptyBusiness = 'workflow-business-empty'
    await insertBusiness(db, { id: emptyBusiness, userId: OWNER, name: 'Empty Co' })
    const emptyStub = await startStubProvider({
      toolScript: [{ name: 'web_search', args: { query: 'Empty topic' } }],
      finalText: '{"brief": "Thin brief with nothing actionable.", "citations": []}',
    })
    const emptyDir = mkdtempSync(join(tmpdir(), 'agent-batch-empty-'))
    try {
      const emptyRuntime = await createAgentModelRuntime({ modelsPath: writeStubModelsConfig(emptyDir, emptyStub.url) })
      await applyRunApiKey(emptyRuntime, 'stub', 'stub-key')
      const model = resolveRunModel(emptyRuntime, 'stub', 'stub-model')
      assert.ok(model, 'stub model resolves')
      const started = await agentRunService.start(OWNER, { businessId: emptyBusiness, agentName: 'topic-batch:days' })
      assert.equal(started.success, true)

      await agentWorkflowService.executeTopicBatch({
        userId: OWNER,
        businessId: emptyBusiness,
        kind: 'days',
        platforms: ['twitter'],
        topic: 'Empty topic',
        runId: started.data.id,
        count: 2,
        run: {
          runtime: emptyRuntime,
          model,
          provider: 'stub',
          modelId: 'stub-model',
          apiKey: 'stub-key',
          apiBaseUrl: null,
          systemContext: 'test context',
          complete: createAgentComplete(emptyRuntime, model),
        },
      })

      const finished = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, started.data.id))
      assert.equal(finished[0].status, 'completed')
      assert.match(finished[0].summary, /brief-derived/)
      assert.match(finished[0].summary, /1 idea cards/)

      const board = await contentBoardService.list(OWNER, emptyBusiness, { state: 'idea' })
      assert.equal(board.data.length, 1)
      assert.ok(board.data[0].brief.includes('Empty topic'))
    } finally {
      await emptyStub.close()
      rmSync(emptyDir, { recursive: true, force: true })
    }
  })
})
