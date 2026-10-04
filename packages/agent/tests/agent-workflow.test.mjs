import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'

/**
 * T29 — topic batch pipeline (research → trend scan → platform-tailored ideas)
 * against the Flue runner. Every model call in this file now goes through the
 * Flue provider path (T26) and the Flue-derived completion helper (T29), so the
 * `run` fixture is a `RunConfig` whose `apiBaseUrl`/`complete` both point at the
 * same stub: the trend-scout agent run and the content-intelligence plugin must
 * see one provider.
 */
const OWNER = 'workflow-owner'
const BUSINESS = 'workflow-business'

let db
let schema
let cleanup
let contentBoardService
let agentWorkflowService
let buildBusinessProvider
let createFlueComplete

/** The `run` fixture: Flue provider seam + Flue completion, both on the stub. */
function stubRunConfig(stub, businessId, overrides = {}) {
  const registration = buildBusinessProvider({
    businessId,
    provider: 'stub',
    model: 'stub-model',
    apiKey: 'stub-key',
    apiBaseUrl: stub.url,
  })
  return {
    runtime: null,
    model: null,
    provider: 'stub',
    modelId: 'stub-model',
    apiKey: 'stub-key',
    apiBaseUrl: stub.url,
    systemContext: 'test context',
    complete: createFlueComplete(registration, { callName: 'test.complete' }),
    ...overrides,
  }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'workflow@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Workflow Co' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ agentWorkflowService } = await import('../server/services/agent-workflow.service.ts'))
  ;({ buildBusinessProvider } = await import('../server/flue/runtime.ts'))
  ;({ createFlueComplete } = await import('../server/flue/complete.ts'))
})

after(() => cleanup())

describe('topic batch pipeline (research → trend scan → ideas)', () => {
  let batchStub

  before(async () => {
    batchStub = await startStubProvider({
      toolScript: [
        { name: 'web_search', args: { query: 'March launch' } },
        { name: 'scan_trends', args: {} },
        { name: 'board_add_cards', args: { cards: [{ title: 'Launch hook', brief: 'Viral angle', platforms: ['twitter'] }, { title: 'Launch story', brief: 'Engagement angle', platforms: ['twitter'] }], sourceType: 'trend' } },
      ],
      finalText: '{"brief": "Test brief: March launch beats expectations with early-bird pricing.", "citations": [{"label": "Test Source", "url": "https://example.com/launch"}]}',
    })
  })

  after(async () => {
    await batchStub.close()
  })

  it('researches the topic, scans trends, and records platform-tailored cards', async () => {
    const { agentRunService } = await import('../server/services/agent-run.service.ts')
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
      run: stubRunConfig(batchStub, BUSINESS),
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
    try {
      const started = await agentRunService.start(OWNER, { businessId: mixedBusiness, agentName: 'topic-batch:days' })

      await agentWorkflowService.executeTopicBatch({
        userId: OWNER,
        businessId: mixedBusiness,
        kind: 'days',
        platforms: ['twitter'],
        topic: 'Mixed topic',
        runId: started.data.id,
        count: 3,
        run: stubRunConfig(mixedStub, mixedBusiness),
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
    try {
      const started = await agentRunService.start(OWNER, { businessId: emptyBusiness, agentName: 'topic-batch:days' })

      await agentWorkflowService.executeTopicBatch({
        userId: OWNER,
        businessId: emptyBusiness,
        kind: 'days',
        platforms: ['twitter'],
        topic: 'Empty topic',
        runId: started.data.id,
        count: 2,
        run: stubRunConfig(emptyStub, emptyBusiness),
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
    }
  })
})