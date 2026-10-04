import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { agentIdentity, resetFlueRuntimeForTests } from '../server/flue/runtime.ts'

/**
 * T04 STOP-GATE spike (PRD-FLUE-AGENT-MIGRATION §T04):
 * - Flue boots in-process with a stub OpenAI-compatible provider (no network, no API keys).
 * - A bounded task executes end-to-end: one tool turn + one text turn.
 * - The result is structured (AgentReply with text).
 * - Tool selection is controlled: only the mounted tool is offered to the model.
 * - The full event stream (turn_request / tool / submission_settled) is observable.
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
  const finalText = options.finalText ?? 'Stub finished the task.'
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    requests.push(payload)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const toolResults = payload.messages.filter(m => m.role === 'tool').length
    if (toolResults === 0) {
      res.write(`data: ${JSON.stringify(sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_stub_1', type: 'function', function: { name: options.toolName ?? 'board_list', arguments: '{}' } }] }))}\n\n`)
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

afterEach(() => {
  resetFlueRuntimeForTests()
})

describe('Flue runtime spike (T04 stop-gate)', () => {
  it('boots, executes one bounded task with one mounted tool, returns a structured reply', async () => {
    const { createProvider } = await import('@earendil-works/pi-ai')
    const { stream, streamSimple } = await import('@earendil-works/pi-ai/api/openai-completions')
    const { init, observe, defineTool, useModel, useTool } = await import('@flue/runtime')
    const { start } = await import('@flue/runtime/node')

    const stub = startStubSseServer()
    await new Promise((resolve) => { stub.server.listen(0, '127.0.0.1', resolve) })
    const port = stub.server.address().port
    const baseUrl = `http://127.0.0.1:${port}/v1`

    const provider = createProvider({
      id: 'stub',
      name: 'Stub Provider',
      baseUrl,
      auth: {
        apiKey: {
          name: 'Stub key',
          resolve: () => Promise.resolve({ auth: { apiKey: 'stub-key' }, source: 'stub' }),
        },
      },
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
    const stopObserving = observe((event) => { events.push(event) })

    const toolCalls = []
    function SmokeAgent() {
      useModel('stub/stub-model')
      const boardList = defineTool({
        name: 'board_list',
        description: 'List content boards.',
        run: async () => {
          toolCalls.push({ name: 'board_list' })
          return { output: [{ id: 'b1', title: 'Ideas' }] }
        },
      })
      useTool(boardList)
      return 'You list content boards with the board_list tool, then summarize.'
    }

    const flue = await start({ agents: [SmokeAgent], providers: [provider] })
    try {
      const handle = init(SmokeAgent, { id: 'spike-1' })
      const receipt = await handle.dispatch({ message: 'List my boards.' })
      const reply = await handle.read(receipt)

      assert.equal(reply.text.trim(), stub.finalText, 'final assistant text matches the stub script')
      assert.equal(toolCalls.length, 1, 'mounted tool executed exactly once')
      assert.equal(stub.requests.length, 2, 'stub saw one tool turn + one text turn')

      // OpenAI-completions wire format: { type: 'function', function: { name } }
      const offered = JSON.stringify(stub.requests[0].tools?.map(tool => tool.function?.name ?? tool.name) ?? [])
      assert.ok(offered.includes('board_list'), 'mounted tool offered to the model')
      assert.ok(stub.requests[1].messages.some(m => m.role === 'tool' && JSON.stringify(m).includes('Ideas')), 'tool result round-tripped to the provider')

      assert.ok(events.some(e => e.type === 'turn_request'), 'turn_request observed (final input available in-process)')
      assert.ok(events.some(e => e.type === 'tool'), 'tool event observed')
      assert.ok(events.some(e => e.type === 'submission_settled' && e.outcome === 'completed'), 'submission settled completed')
    } finally {
      stopObserving()
      await flue.stop()
      await closeServer(stub.server)
    }
  })

  it('reports a stable agent identity', async () => {
    const { defineTool, useModel, useTool } = await import('@flue/runtime')
    function NamedAgent() {
      useModel('stub/stub-model')
      useTool(defineTool({ name: 'noop', description: 'No operation.', run: async () => ({}) }))
      return 'Named agent.'
    }
    NamedAgent.agentName = 'named-agent'
    assert.equal(agentIdentity(NamedAgent), 'named-agent')
  })
})
