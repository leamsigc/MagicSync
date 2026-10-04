import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

// web_search must request full webpage content by default (snippets only on
// explicit opt-out), so research briefs are built from page content.

let cleanup
let createResearchTools

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  ;({ createResearchTools } = await import('../server/agent/tools/research.tools.ts'))
})

after(() => cleanup())

function webSearchTool(captured) {
  const tools = createResearchTools({
    userId: 'u1',
    businessId: 'b1',
    emit: () => {},
    langsearchKey: 'test-key',
    langsearch: async (input) => {
      captured.input = input
      return { success: true, data: { results: [], logId: null, usage: null } }
    },
  })
  const tool = tools.find(entry => entry.name === 'web_search')
  assert.ok(tool, 'web_search tool registered')
  return tool
}

describe('web_search full-text default', () => {
  it('requests capped full text unless explicitly disabled', async () => {
    const captured = {}
    const tool = webSearchTool(captured)
    await runTool(tool, { query: 'summer roofing tips' })
    assert.deepEqual(captured.input.fullText, { maxCharacters: 8000 })
  })

  it('honors explicit snippet opt-out', async () => {
    const captured = {}
    const tool = webSearchTool(captured)
    await runTool(tool, { query: 'summer roofing tips', fullText: false })
    assert.equal(captured.input.fullText, false)
  })
})
