import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// T04 — tool context isolation: tenant identity comes from the server context,
// never from model-supplied tool arguments.
const OWNER = 'tools-owner'
const BUSINESS_A = 'tools-business-a'
const BUSINESS_B = 'tools-business-b'

let cleanup
let contentBoardService
let boardTools
let createAgentTools
let createAgentToolContext
let contextA

function findTool(tools, name) {
  const tool = tools.find(entry => entry.name === name)
  assert.ok(tool, `tool ${name} exists`)
  return tool
}

function parseToolResult(result) {
  return JSON.parse(result.content[0].text)
}

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'tools@test.local' })
  await insertBusiness(init.db, { id: BUSINESS_A, userId: OWNER, name: 'Tools A' })
  await insertBusiness(init.db, { id: BUSINESS_B, userId: OWNER, name: 'Tools B' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  contextA = createAgentToolContext({ userId: OWNER, businessId: BUSINESS_A })
  boardTools = createAgentTools(contextA)
})

after(() => cleanup())

describe('board tools (T04)', () => {
  it('board_list ignores a model-supplied foreign businessId', async () => {
    await contentBoardService.create(OWNER, BUSINESS_A, { title: 'A card' })
    await contentBoardService.create(OWNER, BUSINESS_B, { title: 'B card' })

    const tool = findTool(boardTools, 'board_list')
    const result = await tool.execute('call-1', { businessId: BUSINESS_B }, undefined, undefined, undefined)
    const payload = parseToolResult(result)
    assert.deepEqual(payload.cards.map(card => card.title), ['A card'])
  })

  it('board_add_cards writes to the session business only', async () => {
    const tool = findTool(boardTools, 'board_add_cards')
    await tool.execute('call-2', {
      cards: [{ title: 'Injected card' }],
      businessId: BUSINESS_B,
    }, undefined, undefined, undefined)

    const foreign = await contentBoardService.list(OWNER, BUSINESS_B)
    assert.ok(!foreign.data.some(card => card.title === 'Injected card'), 'not added to foreign business')
    const session = await contentBoardService.list(OWNER, BUSINESS_A)
    assert.ok(session.data.some(card => card.title === 'Injected card'), 'added to session business')
  })

  it('board_move cannot approve as an agent', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS_A, { title: 'Approval card' })
    for (const state of ['researching', 'research_ready', 'drafting', 'review_required']) {
      await contentBoardService.move(OWNER, BUSINESS_A, created.data.id, state, { actorKind: 'agent' })
    }

    const tool = findTool(boardTools, 'board_move')
    await assert.rejects(
      tool.execute('call-3', { itemId: created.data.id, toState: 'approved' }, undefined, undefined, undefined),
      /HUMAN_ACTION_REQUIRED/,
    )
  })
})
