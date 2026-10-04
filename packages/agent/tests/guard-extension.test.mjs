import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import { initTestDb } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

/**
 * T28 — the tool guard, on Flue. The pi `tool_call` extension is gone: the
 * allowlist is now a mount filter (`selectAgentTools`) plus a call-time
 * interceptor (`guardAgentTools`), composed by `mountAgentTools`. Both audit
 * events the extension emitted are asserted here — a blocked tool and an
 * allowed one.
 */

let cleanupDb
let selectAgentTools
let guardAgentTools
let mountAgentTools
let createAgentToolBag
let createAgentToolContext
let TOOL_NOT_ALLOWED

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  ;({
    selectAgentTools,
    guardAgentTools,
    mountAgentTools,
    createAgentToolBag,
    TOOL_NOT_ALLOWED,
  } = await import('../server/agent/tools/mounts.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
})

after(() => cleanupDb())

function stubTool(name) {
  return defineTool({
    name,
    description: `Stub ${name}.`,
    input: v.object({ note: v.optional(v.string()) }),
    run: async () => ({ output: { ran: name } }),
  })
}

const BAG = [stubTool('web_search'), stubTool('board_list'), stubTool('publish')]

function audits() {
  const entries = []
  return { entries, sink: entry => entries.push(entry) }
}

describe('tool guard on Flue (T28)', () => {
  it('mounts only the allowlist and audits every withheld tool as blocked', () => {
    const { entries, sink } = audits()
    const selected = selectAgentTools(BAG, { agent: 'research-agent', allowedTools: ['web_search'], onAudit: sink })

    assert.deepEqual(selected.map(tool => tool.name), ['web_search'], 'the mount is the allowlist, not the bag')
    assert.deepEqual(entries, [
      { toolName: 'board_list', blocked: true, reason: TOOL_NOT_ALLOWED, agent: 'research-agent' },
      { toolName: 'publish', blocked: true, reason: TOOL_NOT_ALLOWED, agent: 'research-agent' },
    ], 'each withheld tool emits the blocked audit event')
  })

  it('audits an allowed invocation and returns the tool output', async () => {
    const { entries, sink } = audits()
    const guarded = mountAgentTools(BAG, { agent: 'research-agent', allowedTools: ['web_search'], onAudit: sink })
    const output = await runTool(guarded[0], { note: 'hi' })

    assert.deepEqual(output, { ran: 'web_search' })
    assert.deepEqual(entries.filter(entry => !entry.blocked), [
      { toolName: 'web_search', blocked: false, agent: 'research-agent' },
    ], 'an allowed call is audited too')
  })

  it('refuses a blocked call with TOOL_NOT_ALLOWED and still audits it', async () => {
    const { entries, sink } = audits()
    // A tool that reached an interceptor without being selected (a stale bag
    // entry, a renamed tool): the interceptor is the second line.
    const guarded = guardAgentTools([stubTool('bash')], {
      agent: 'magicsync-default',
      allowedTools: ['web_search'],
      onAudit: sink,
    })

    const output = await runTool(guarded[0], { note: 'rm -rf /' })
    assert.equal(output.error, TOOL_NOT_ALLOWED)
    assert.match(output.message, /not enabled for magicsync-default/)
    assert.equal(output.blocked, true)
    assert.deepEqual(entries, [
      { toolName: 'bash', blocked: true, reason: TOOL_NOT_ALLOWED, agent: 'magicsync-default' },
    ], 'a refused call still emits the audit event')
  })

  it('keeps tenant identity out of the model-supplied input', () => {
    const bag = createAgentToolBag(createAgentToolContext({ userId: 'u1', businessId: 'b1' }))
    assert.deepEqual(v.parse(bag.board_list.input, { businessId: 'b2', userId: 'u2' }), {}, 'identity keys are stripped, never accepted')
  })

  it('registers no pi tool fields: valibot input plus run, no parameters/execute', () => {
    const bag = createAgentToolBag(createAgentToolContext({ userId: 'u1', businessId: 'b1' }))
    for (const tool of Object.values(bag)) {
      assert.equal(tool.parameters, undefined, `${tool.name} has no typebox parameters`)
      assert.equal(tool.execute, undefined, `${tool.name} has no pi execute`)
      assert.equal(typeof tool.run, 'function', `${tool.name} runs on Flue`)
      assert.ok(tool.input, `${tool.name} declares a valibot input`)
    }
  })
})
