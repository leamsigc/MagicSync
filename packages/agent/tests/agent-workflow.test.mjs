import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'
import { writeStubModelsConfig } from './stub-models.mjs'
import { applyRunApiKey, createAgentModelRuntime } from '../server/utils/pi-runtime.ts'

const OWNER = 'workflow-owner'
const BUSINESS = 'workflow-business'

let db
let schema
let cleanup
let chatService
let contentBoardService
let agentWorkflowService
let createAgentTools
let createAgentToolContext
let runtime
let stub
let dir

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'workflow@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Workflow Co' })
  ;({ chatService } = await import('#layers/BaseDB/server/services/chat.service.ts'))
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ agentWorkflowService } = await import('../server/services/agent-workflow.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  stub = await startStubProvider({
    toolScript: [
      { name: 'scan_trends', args: {} },
      { name: 'board_add_cards', args: { cards: [{ title: 'Trend idea one' }, { title: 'Trend idea two' }], sourceType: 'trend' } },
    ],
    finalText: 'Added trend cards.',
  })
  dir = mkdtempSync(join(tmpdir(), 'agent-workflow-'))
  const modelsPath = writeStubModelsConfig(dir, stub.url)
  runtime = await createAgentModelRuntime({ modelsPath })
  await applyRunApiKey(runtime, 'stub', 'stub-key')
})

after(async () => {
  await stub.close()
  rmSync(dir, { recursive: true, force: true })
  await cleanup()
})

describe('trend scan workflow (T06)', () => {
  it('runs scan_trends then board_add_cards and records content runs', async () => {
    const thread = await chatService.createThread(OWNER, { title: 'Trend scan' })
    const context = createAgentToolContext({ userId: OWNER, businessId: BUSINESS })
    const events = []
    const result = await agentWorkflowService.runTrendScan({
      userId: OWNER,
      businessId: BUSINESS,
      threadId: thread.data.id,
      text: 'ignored — workflow owns the prompt',
      provider: 'stub',
      model: 'stub-model',
      modelRuntime: runtime,
      customTools: createAgentTools(context),
    }, event => { events.push(event) })

    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.cards.length, 2)
    assert.ok(result.data.cards.every(card => card.state === 'idea'))
    assert.ok(result.data.cards.every(card => card.sourceType === 'trend'))

    const toolNames = events.filter(event => event.type === 'tool.started').map(event => event.toolName)
    assert.deepEqual(toolNames, ['scan_trends', 'board_add_cards'])

    const board = await contentBoardService.list(OWNER, BUSINESS, { state: 'idea' })
    assert.ok(board.data.some(card => card.title === 'Trend idea one'))
    assert.ok(board.data.some(card => card.title === 'Trend idea two'))

    const runs = await db.select().from(schema.contentRuns).where(eq(schema.contentRuns.step, 'trend_scan'))
    assert.equal(runs.length, 2)
    assert.ok(runs.every(run => run.status === 'completed'))
  })
})
