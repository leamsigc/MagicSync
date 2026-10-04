import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T05: MagicSyncAgent + capability registry + runCapability entry
 * (PRD-FLUE-AGENT-MIGRATION §4.4).
 *
 * - MagicSyncAgent executes a bounded task end-to-end inside Flue against a
 *   hermetic OpenAI-compatible SSE stub (no network, no API keys): one
 *   `plan_lookup` tool turn + one text turn, structured reply, only the
 *   mounted tool offered to the model.
 * - `goal.execute` runs a complete goal through the single entry:
 *   deterministic routing (zero model calls), stable SSE contract with the
 *   run/step envelope (`run.started` → `step.completed` → `run.completed`)
 *   and an `agent_runs` row per run.
 */

const OWNER = 'msa-owner'
const BUSINESS = 'msa-business'
const MODEL_ID = 'stub-model'

let cleanupDb
let runCapability
let agentRunService

const completeNever = async () => { throw new Error('no model calls expected in routed runs') }

function baseCtx(overrides = {}) {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    complete: completeNever,
    systemContext: '',
    ...overrides,
  }
}

function sseChunk(delta, finishReason = null) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

function startStubSseServer({ toolName, toolArgs, finalText }) {
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    requests.push(payload)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const toolResults = payload.messages.filter(m => m.role === 'tool').length
    if (toolResults === 0) {
      res.write(`data: ${JSON.stringify(sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_stub_1', type: 'function', function: { name: toolName, arguments: JSON.stringify(toolArgs) } }] }))}\n\n`)
      res.write(`data: ${JSON.stringify({ ...sseChunk({}, 'tool_calls'), usage: { prompt_tokens: 21, completion_tokens: 7, total_tokens: 28 } })}\n\n`)
    } else {
      for (const word of finalText.split(' ')) {
        res.write(`data: ${JSON.stringify(sseChunk({ role: 'assistant', content: `${word} ` }))}\n\n`)
      }
      res.write(`data: ${JSON.stringify({ ...sseChunk({}, 'stop'), usage: { prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 } })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
  })
  return { server, requests, finalText }
}

function closeServer(server) {
  return new Promise(resolve => server.close(() => resolve()))
}

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'msa@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'MSA Co' })
  // Import registers builtin capabilities (goal.plan + goal.execute).
  const goal = await import('../server/capabilities/goal.ts')
  runCapability = goal.runCapability
  ;({ agentRunService } = await import('../server/services/agent-run.service.ts'))
})

after(() => cleanupDb())

describe('MagicSyncAgent in Flue (T05)', () => {
  it('lookupPlan matches deterministically with zero model calls', async () => {
    const { lookupPlan } = await import('../server/flue/magicsync-agent.ts')
    const matched = lookupPlan('Help me get more customers')
    assert.equal(matched.routed, true)
    assert.ok(matched.steps.length >= 2)
    assert.ok(matched.steps.every(step => step.id && step.title))
    assert.deepEqual(lookupPlan('xylophone quantum taxation'), { routed: false, steps: [] })
  })

  it('executes a bounded task end-to-end with only plan_lookup mounted', async () => {
    const { createProvider } = await import('@earendil-works/pi-ai')
    const { stream, streamSimple } = await import('@earendil-works/pi-ai/api/openai-completions')
    const { init, observe } = await import('@flue/runtime')
    const { start } = await import('@flue/runtime/node')
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')

    const finalText = 'Here is your plan in plain words.'
    const stub = startStubSseServer({
      toolName: 'plan_lookup',
      toolArgs: { goal: 'Help me get more customers' },
      finalText,
    })
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    const baseUrl = `http://127.0.0.1:${port}/v1`

    const provider = createProvider({
      id: 'stub',
      name: 'Stub Provider',
      baseUrl,
      auth: { apiKey: { name: 'Stub key', resolve: () => Promise.resolve({ auth: { apiKey: 'stub-key' }, source: 'stub' }) } },
      models: [{
        id: MODEL_ID,
        name: 'Stub Model',
        api: 'openai-completions',
        provider: 'stub',
        baseUrl,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      }],
      api: { 'openai-completions': { stream, streamSimple } },
    })

    const events = []
    const stopObserving = observe(event => events.push(event))
    const MagicSyncAgent = createMagicSyncAgent({ model: 'stub/stub-model', systemContext: 'Test business context.' })
    assert.equal(MagicSyncAgent.name, 'MagicSyncAgent')

    const flue = await start({ agents: [MagicSyncAgent], providers: [provider] })
    try {
      const handle = init(MagicSyncAgent, { id: 'msa-1' })
      const receipt = await handle.dispatch({ message: 'Help me get more customers.' })
      const reply = await handle.read(receipt)

      assert.equal(reply.text.trim(), finalText)
      assert.equal(stub.requests.length, 2, 'one tool turn + one text turn')
      const offered = (stub.requests[0].tools ?? []).map(tool => tool.function?.name ?? tool.name).sort()
      assert.deepEqual(offered, ['plan_lookup', 'task'], 'only the mounted tool plus Flue\'s built-in task tool')
      const toolResultMsg = stub.requests[1].messages.find(m => m.role === 'tool')
      assert.ok(JSON.stringify(toolResultMsg).includes('routed'), 'plan_lookup result round-tripped')
      assert.ok(events.some(e => e.type === 'turn_request'), 'final input observable in-process')
      assert.ok(events.some(e => e.type === 'submission_settled' && e.outcome === 'completed'), 'bounded run settled')
    } finally {
      stopObserving()
      await flue.stop()
      await closeServer(stub.server)
    }
  })
})

describe('goal.execute through runCapability (T05)', () => {
  it('runs a routed goal end-to-end with stable SSE events and an agent_runs row', async () => {
    const events = []
    const outcome = await runCapability(
      'goal.execute',
      { goal: 'Help me get more customers' },
      baseCtx({ onEvent: event => events.push(event) }),
    )
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.routed, true, 'keyword router matched without a model call')
    assert.ok(outcome.output.steps.length >= 2)
    assert.ok(outcome.output.reply.includes('1.'), 'reply lists numbered steps')
    assert.ok(outcome.output.reply.includes('start with #1'), 'reply names one next step')

    const types = events.map(event => event.type)
    assert.equal(types[0], 'message.started')
    assert.equal(types[1], 'run.started')
    assert.equal(types.at(-2), 'message.completed')
    assert.equal(types.at(-1), 'run.completed')
    assert.ok(types.includes('step.completed'), 'step rail receives real step events')
    const runId = events[0].sessionId
    assert.ok(events.every(event => event.id.startsWith(`${runId}:`)), 'stable ids')

    const listed = await agentRunService.listByBusiness(OWNER, BUSINESS, 10)
    assert.equal(listed.success, true)
    const row = listed.data.find(candidate => candidate.id === runId)
    assert.ok(row, 'run row recorded')
    assert.equal(row.status, 'completed')
    assert.equal(row.agentName, 'MagicSyncAgent')
  })

  it('plans an unrouted goal through the model path with validation', async () => {
    const scriptedComplete = async () => JSON.stringify({
      goal: 'Custom goal xylophone',
      summary: 'A plan',
      steps: [{ id: 'create-content-ideas', skill: 'create-content-ideas', title: 'Ideas', type: 'creation', dependsOn: [] }],
    })
    const events = []
    const outcome = await runCapability(
      'goal.execute',
      { goal: 'Custom goal xylophone' },
      baseCtx({ complete: scriptedComplete, onEvent: event => events.push(event) }),
    )
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.routed, false)
    assert.equal(outcome.output.steps[0].id, 'create-content-ideas')
    assert.equal(events.at(-1).type, 'run.completed')
  })

  it('fails loudly with GOAL_UNPLANABLE and an error event when no plan exists', async () => {
    const events = []
    const outcome = await runCapability(
      'goal.execute',
      { goal: 'xylophone quantum taxation' },
      baseCtx({ onEvent: event => events.push(event) }),
    )
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'GOAL_UNPLANABLE', 'planner contract code (existing spelling)')
    assert.deepEqual(events.map(event => event.type), ['message.started', 'error'], 'failure emits an error event')
  })

  it('rejects unknown capabilities and invalid inputs with typed codes', async () => {
    const unknown = await runCapability('nope.nada', {}, baseCtx())
    assert.equal(unknown.ok, false)
    assert.equal(unknown.code, 'CAPABILITY_UNKNOWN')
    const invalid = await runCapability('goal.execute', { goal: '' }, baseCtx())
    assert.equal(invalid.ok, false)
    assert.equal(invalid.code, 'VALIDATION_ERROR')
  })
})
