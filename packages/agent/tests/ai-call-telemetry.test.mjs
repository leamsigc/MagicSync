import { describe, it, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T19: AI-call telemetry (PRD §5.4/§5.5). One `ai.call` event per model call,
 * policy-gated content (AGENT_AI_LOG), credentials never logged at any level.
 */

const MODEL_ID = 'stub-model'

function sseChunk(delta, finishReason = null) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

function startStubSseServer(options = {}) {
  const requests = []
  const finalText = options.finalText ?? 'Telemetry roundtrip done.'
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    requests.push(payload)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const toolResults = payload.messages.filter(m => m.role === 'tool').length
    if (toolResults === 0) {
      res.write(`data: ${JSON.stringify(sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_stub_1', type: 'function', function: { name: 'noop', arguments: '{}' } }] }))}\n\n`)
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
  return new Promise((resolve) => { server.close(() => resolve()) })
}

function startFlueWithTelemetry(stubUrl) {
  return (async () => {
    const { createProvider } = await import('@earendil-works/pi-ai')
    const { stream, streamSimple } = await import('@earendil-works/pi-ai/api/openai-completions')
    const { init, defineTool, useModel, useTool } = await import('@flue/runtime')
    const { start } = await import('@flue/runtime/node')
    const telemetry = await import('../server/capabilities/telemetry.ts')
    const { installAiCallTelemetry, clearAiCallSink } = telemetry

    clearAiCallSink()
    const unsubscribe = await installAiCallTelemetry()

    const provider = createProvider({
      id: 'stub',
      name: 'Stub Provider',
      baseUrl: stubUrl,
      auth: { apiKey: { name: 'Stub key', resolve: () => Promise.resolve({ auth: { apiKey: 'stub-key-SECRET' }, source: 'stub' }) } },
      models: [{
        id: MODEL_ID,
        name: 'Stub Model',
        api: 'openai-completions',
        provider: 'stub',
        baseUrl: stubUrl,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      }],
      api: { 'openai-completions': { stream, streamSimple } },
    })

    function TelemetryAgent() {
      useModel('stub/stub-model')
      useTool(defineTool({ name: 'noop', description: 'No operation.', run: async () => ({ output: 'ok' }) }))
      return 'Run the noop tool, then summarize.'
    }

    const flue = await start({ agents: [TelemetryAgent], providers: [provider] })
    const handle = init(TelemetryAgent, { id: 'telemetry-1' })
    return { flue, handle, unsubscribe, telemetry }
  })()
}

async function runAgentOnce(handle) {
  const receipt = await handle.dispatch({ message: 'Do the noop.' })
  const reply = await handle.read(receipt)
  return reply
}

const OWNER = 'telemetry-owner'
const BUSINESS = 'telemetry-business'

let cleanupDb

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'telemetry@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Telemetry Co' })
})

after(() => cleanupDb())

function resetPolicyEnv() {
  delete process.env.AGENT_AI_LOG
  delete process.env.AGENT_AI_LOG_MAX_BYTES
}

afterEach(() => {
  resetPolicyEnv()
})

describe('ai.call telemetry (T19)', () => {
  it('emits exactly one ai.call event per model call with metadata under the default policy', async () => {
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    let harness
    try {
      harness = await startFlueWithTelemetry(`http://127.0.0.1:${port}/v1`)
      const reply = await runAgentOnce(harness.handle)
      assert.ok(reply.text.trim().length > 0)

      const aiCalls = harness.telemetry.getAiCallSink()
      assert.equal(aiCalls.length, 2, 'exactly one ai.call per model call (tool turn + text turn)')

      const first = aiCalls[0]
      assert.equal(first.contentPolicy, 'metadata', 'default policy is metadata')
      assert.ok(first.provider, 'provider recorded')
      assert.equal(first.model, MODEL_ID, 'model recorded')
      assert.ok(typeof first.latencyMs === 'number', 'latency recorded')
      assert.ok(first.usage && first.usage.promptTokens >= 0, 'token usage recorded')
      assert.ok(Array.isArray(first.toolNames) && first.toolNames.includes('noop'), 'tool names recorded')
      assert.equal(first.input, undefined, 'no prompt content under metadata policy')
      assert.equal(first.output, undefined, 'no output content under metadata policy')
    } finally {
      harness.unsubscribe()
      await harness.flue.stop()
      await closeServer(stub.server)
    }
  })

  it('redacted policy scrubs credentials and personal data but keeps content', async () => {
    process.env.AGENT_AI_LOG = 'redacted'
    const secret = 'sk-supersecretkey123'
    const stub = startStubSseServer({ finalText: `Contact owner@example.com or ${secret} for details.` })
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    let harness
    try {
      harness = await startFlueWithTelemetry(`http://127.0.0.1:${port}/v1`)
      await runAgentOnce(harness.handle)

      const aiCalls = harness.telemetry.getAiCallSink()
      assert.equal(aiCalls.length, 2)
      const serialized = JSON.stringify(aiCalls)
      assert.ok(!serialized.includes('owner@example.com'), 'emails scrubbed')
      assert.ok(!serialized.includes(secret), 'api-key-like strings scrubbed')
      assert.ok(serialized.includes('[redacted-email]'), 'redaction sentinel present')
    } finally {
      harness.unsubscribe()
      await harness.flue.stop()
      await closeServer(stub.server)
    }
  })

  it('payload policy carries the final input and output truncated to the cap', async () => {
    process.env.AGENT_AI_LOG = 'payload'
    process.env.AGENT_AI_LOG_MAX_BYTES = '400'
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    let harness
    try {
      harness = await startFlueWithTelemetry(`http://127.0.0.1:${port}/v1`)
      await runAgentOnce(harness.handle)

      const aiCalls = harness.telemetry.getAiCallSink()
      assert.ok(aiCalls.length >= 1)
      const withPayload = aiCalls.filter(e => e.input !== undefined)
      assert.ok(withPayload.length >= 1, 'final input captured under payload policy')
      for (const call of withPayload) {
        const size = JSON.stringify(call.input).length
        assert.ok(size <= 420, `input truncated to cap (got ${size})`)
      }
    } finally {
      harness.unsubscribe()
      await harness.flue.stop()
      await closeServer(stub.server)
    }
  })

  it('correlates every call with the AsyncLocalStorage run context', async () => {
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    let harness
    try {
      harness = await startFlueWithTelemetry(`http://127.0.0.1:${port}/v1`)
      const { withAiCallContext } = harness.telemetry
      await withAiCallContext(
        { runId: 'run-ctx-1', capability: 'goal.execute', agent: 'MagicSyncAgent' },
        () => runAgentOnce(harness.handle),
      )

      const aiCalls = harness.telemetry.getAiCallSink()
      assert.equal(aiCalls.length, 2)
      for (const call of aiCalls) {
        assert.equal(call.runId, 'run-ctx-1', 'run id correlated')
        assert.equal(call.capability, 'goal.execute', 'capability correlated')
        assert.ok(typeof call.agent === 'string' && call.agent.length > 0, 'agent attributed')
      }
    } finally {
      harness.unsubscribe()
      await harness.flue.stop()
      await closeServer(stub.server)
    }
  })

  it('writes one compact agent_runs row per model call for debugging without a log drain', async () => {
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    const { agentRunService } = await import('../server/services/agent-run.service.ts')
    const before = await agentRunService.listByBusiness(OWNER, BUSINESS, 50)
    assert.equal(before.success, true)
    let harness
    try {
      harness = await startFlueWithTelemetry(`http://127.0.0.1:${port}/v1`)
      const { withAiCallContext, flushAiCallRecords } = harness.telemetry
      await withAiCallContext(
        { capability: 'goal.execute', agent: 'MagicSyncAgent', userId: OWNER, businessId: BUSINESS },
        () => runAgentOnce(harness.handle),
      )
      await flushAiCallRecords()

      const listed = await agentRunService.listByBusiness(OWNER, BUSINESS, 50)
      assert.equal(listed.success, true)
      const rows = listed.data.filter(row => row.agentName === 'ai.call:goal.execute')
      assert.equal(rows.length, 2, 'one compact row per model call')
      for (const row of rows) {
        assert.equal(row.status, 'completed')
        assert.ok(row.tokensUsed > 0, 'token usage recorded on the row')
        assert.ok((row.durationMs ?? 0) >= 0, 'duration recorded on the row')
        assert.match(row.summary, /stub\/stub-model/, 'row names the provider/model')
      }
      assert.equal(before.data.length + 2, listed.data.length, 'no other rows written')
    } finally {
      harness.unsubscribe()
      await harness.flue.stop()
      await closeServer(stub.server)
    }
  })
})
