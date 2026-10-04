import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { findTool, runTool } from './flue-tool.mjs'

// T04 — tool context isolation: tenant identity comes from the server context,
// never from model-supplied tool arguments. T28 — the tools are Flue tools
// (valibot `input` + `run`), so a foreign `businessId` is not merely ignored:
// valibot strips unknown keys before `run` ever sees them.
const OWNER = 'tools-owner'
const BUSINESS_A = 'tools-business-a'
const BUSINESS_B = 'tools-business-b'

let cleanup
let contentBoardService
let boardTools
let createAgentToolBag
let createAgentToolContext

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'tools@test.local' })
  await insertBusiness(init.db, { id: BUSINESS_A, userId: OWNER, name: 'Tools A' })
  await insertBusiness(init.db, { id: BUSINESS_B, userId: OWNER, name: 'Tools B' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ createAgentToolBag } = await import('../server/agent/tools/mounts.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  boardTools = createAgentToolBag(createAgentToolContext({ userId: OWNER, businessId: BUSINESS_A }))
})

after(() => cleanup())

describe('board tools (T04)', () => {
  it('board_list ignores a model-supplied foreign businessId', async () => {
    await contentBoardService.create(OWNER, BUSINESS_A, { title: 'A card' })
    await contentBoardService.create(OWNER, BUSINESS_B, { title: 'B card' })

    const tool = findTool(boardTools, 'board_list')
    const payload = await runTool(tool, { businessId: BUSINESS_B })
    assert.deepEqual(payload.cards.map(card => card.title), ['A card'])
  })

  it('board_list valibot input rejects a model-supplied businessId outright', async () => {
    const { parse } = await import('valibot')
    const parsed = parse(findTool(boardTools, 'board_list').input, { businessId: BUSINESS_B })
    assert.deepEqual(Object.keys(parsed), [], 'no identity field survives the schema')
  })

  it('board_add_cards writes to the session business only', async () => {
    const tool = findTool(boardTools, 'board_add_cards')
    await runTool(tool, {
      cards: [{ title: 'Injected card' }],
      businessId: BUSINESS_B,
    })

    const foreign = await contentBoardService.list(OWNER, BUSINESS_B)
    assert.ok(!foreign.data.some(card => card.title === 'Injected card'), 'not added to foreign business')
    const session = await contentBoardService.list(OWNER, BUSINESS_A)
    assert.ok(session.data.some(card => card.title === 'Injected card'), 'added to session business')
  })

  it('board_move cannot approve as an agent', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS_A, { title: 'Approval card' })
    for (const state of ['drafting', 'review_required']) {
      await contentBoardService.move(OWNER, BUSINESS_A, created.data.id, state, { actorKind: 'agent' })
    }

    const tool = findTool(boardTools, 'board_move')
    await assert.rejects(
      runTool(tool, { itemId: created.data.id, toState: 'scheduled' }),
      /HUMAN_ACTION_REQUIRED/,
    )
  })
})
