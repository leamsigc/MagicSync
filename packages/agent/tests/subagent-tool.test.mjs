import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'
import { writeStubModelsConfig } from './stub-models.mjs'
import { applyRunApiKey, createAgentModelRuntime } from '../server/utils/pi-runtime.ts'

// In-process subagent delegation on @earendil-works/pi-agent-core.
const OWNER = 'subagent-owner'
const BUSINESS = 'subagent-business'

const DRAFT_JSON = JSON.stringify({
  caption: 'Three-step onboarding with 40% less effort. Link in bio. #onboarding',
  platformVariants: { instagram: 'Three-step onboarding with 40% less effort. #onboarding' },
  slideCopy: [],
  cta: 'Link in bio',
  claims: ['three-step onboarding'],
  sources: [],
})

let cleanup
let createAgentTools
let createAgentToolContext
let runtime
let stub
let dir

function parseResult(result) {
  return JSON.parse(result.content[0].text)
}

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'subagent@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Subagent Co' })
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  stub = await startStubProvider({
    toolScript: [{ name: 'write_post', args: { brief: 'Onboarding research brief', platforms: ['instagram'] } }],
    finalText: 'Subagent wrote the post.',
  })
  dir = mkdtempSync(join(tmpdir(), 'agent-subagent-'))
  const modelsPath = writeStubModelsConfig(dir, stub.url)
  runtime = await createAgentModelRuntime({ modelsPath })
  await applyRunApiKey(runtime, 'stub', 'stub-key')
})

after(async () => {
  await stub.close()
  rmSync(dir, { recursive: true, force: true })
  await cleanup()
})

function buildTools() {
  const ctx = createAgentToolContext({
    userId: OWNER,
    businessId: BUSINESS,
    complete: async () => DRAFT_JSON,
    modelRuntime: runtime,
    model: runtime.getModel('stub', 'stub-model'),
  })
  const tools = createAgentTools(ctx)
  ctx.subagentTools = tools
  return tools
}

describe('subagent tool', () => {
  it('runs a predefined agent in-process with only its allowed tools', async () => {
    const tools = buildTools()
    const tool = tools.find(entry => entry.name === 'subagent')
    assert.ok(tool, 'subagent tool exists')
    assert.match(tool.description, /researcher/)

    const result = await tool.execute('call-1', { agent: 'writer', task: 'Draft an onboarding post.' }, undefined, undefined, undefined)
    assert.match(result.content[0].text, /Subagent wrote the post/)
    assert.equal(result.details.agent, 'writer')
    assert.ok(result.details.turns >= 1)

    const toolNames = stub.requests.at(-1).tools.map(entry => entry.function.name).sort()
    assert.deepEqual(toolNames, ['board_update', 'retrieve', 'write_post'], 'child sees only writer tools, never subagent')
  })

  it('rejects unknown and orchestrator agents with a typed error', async () => {
    const tools = buildTools()
    const tool = tools.find(entry => entry.name === 'subagent')
    await assert.rejects(
      () => tool.execute('call-2', { agent: 'nope', task: 'x' }, undefined, undefined, undefined),
      /SUBAGENT_UNKNOWN/,
    )
    await assert.rejects(
      () => tool.execute('call-3', { agent: 'orchestrator', task: 'x' }, undefined, undefined, undefined),
      /SUBAGENT_UNKNOWN/,
    )
  })

  it('reports a typed error when no model runtime is bound', async () => {
    const ctx = createAgentToolContext({ userId: OWNER, businessId: BUSINESS })
    const tools = createAgentTools(ctx)
    ctx.subagentTools = tools
    const tool = tools.find(entry => entry.name === 'subagent')
    await assert.rejects(
      () => tool.execute('call-4', { agent: 'humanizer', task: 'x' }, undefined, undefined, undefined),
      /SUBAGENT_UNAVAILABLE/,
    )
  })
})
