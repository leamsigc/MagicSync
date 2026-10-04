import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T09 vertical slice B — STOP GATE (PRD §8.2): "Give me 10 Facebook ideas
 * about roofing maintenance." ContentAgent → topic research → business
 * context → create-content-ideas → validation, returning the existing
 * `{ research, ideas }` contract. Hermetic: Flue turns via SSE stub, skill
 * model calls via a scripted completion. No network.
 */

const OWNER = 'slice-b-owner'
const BUSINESS = 'slice-b-business'
const MODEL_ID = 'stub-model'

let cleanupDb

function makeIdeas() {
  return Array.from({ length: 10 }, (_, i) => ({
    title: `Roofing maintenance idea ${i + 1}`,
    brief: `Checkup angle ${i + 1} for homeowners`,
    platforms: ['facebook'],
    platformDetails: {},
  }))
}

const RESEARCH_JSON = JSON.stringify({
  brief: 'Roofing maintenance keeps small leaks from becoming replacements.',
  citations: [
    { label: 'Roofing guide', url: 'https://guide.example/roof' },
    { label: 'Maintenance study', url: 'https://study.example/maintain' },
  ],
})

function scriptedComplete(calls, mode = 'ok') {
  return async ({ prompt }) => {
    calls.push(prompt)
    if (mode === 'throw') throw new Error('provider down')
    if (prompt.includes('You are a thorough research assistant.')) return RESEARCH_JSON
    if (prompt.includes('You are a social media strategist writing content ideas')) {
      return JSON.stringify({ ideas: makeIdeas() })
    }
    if (prompt.includes('{"ideas":')) return JSON.stringify({ ideas: makeIdeas() })
    throw new Error(`unmatched content prompt: ${prompt.slice(0, 120)}`)
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

function toolCallChunk(name, args) {
  return sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: `call_${name}_${Math.random().toString(36).slice(2, 8)}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })
}

function textChunks(text) {
  return text.split(' ').map(word => `data: ${JSON.stringify(sseChunk({ role: 'assistant', content: `${word} ` }))}\n\n`).join('')
}

function startStubSseServer() {
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    requests.push(payload)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const toolNames = (payload.tools ?? []).map(tool => tool.function?.name ?? tool.name)
    const toolResults = payload.messages.filter(m => m.role === 'tool').length
    if (toolNames.includes('create-content-ideas') && toolResults === 0) {
      res.write(`data: ${JSON.stringify(toolCallChunk('create-content-ideas', { topic: 'roofing maintenance', quantity: 10, platforms: ['facebook'] }))}\n\n`)
    } else if (toolNames.includes('plan_lookup') && toolResults === 0) {
      res.write(`data: ${JSON.stringify(toolCallChunk('task', { agent: 'content-agent', prompt: 'Ideate roofing maintenance.' }))}\n\n`)
    } else {
      res.write(textChunks('Ideas are ready for review.'))
    }
    res.write(`data: ${JSON.stringify(sseChunk({}, 'stop'))}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  })
  return { server, requests }
}

function closeServer(server) {
  return new Promise(resolve => server.close(() => resolve()))
}

async function startFlueProvider(stubUrl) {
  const { createProvider } = await import('@earendil-works/pi-ai')
  const { stream, streamSimple } = await import('@earendil-works/pi-ai/api/openai-completions')
  return createProvider({
    id: 'stub',
    name: 'Stub Provider',
    baseUrl: stubUrl,
    auth: { apiKey: { name: 'Stub key', resolve: () => Promise.resolve({ auth: { apiKey: 'stub-key' }, source: 'stub' }) } },
    models: [{
      id: MODEL_ID, name: 'Stub Model', api: 'openai-completions', provider: 'stub', baseUrl: stubUrl,
      reasoning: false, input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000, maxTokens: 4096,
    }],
    api: { 'openai-completions': { stream, streamSimple } },
  })
}

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'sliceb@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'SliceB Co' })
})

after(() => cleanupDb())

function sliceContext(overrides = {}) {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    systemContext: 'Test playbook grounding for SliceB Co.',
    complete: scriptedComplete([]),
    flueModel: 'stub/stub-model',
    ...overrides,
  }
}

describe('vertical slice B end-to-end (T09 STOP GATE)', () => {
  it('returns validated { research, ideas } for 10 Facebook roofing ideas', async () => {
    const { runSliceB } = await import('../server/flue/slice-b.ts')
    const { stopFlueRuntime } = await import('../server/flue/runtime.ts')
    const { createContentIdeasSkill } = await import('../server/agentic/skills/create-content-ideas.ts')
    const completeCalls = []
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    try {
      const outcome = await runSliceB('roofing maintenance', ['facebook'], sliceContext({
        complete: scriptedComplete(completeCalls),
        flueProvider: await startFlueProvider(`http://127.0.0.1:${port}/v1`),
      }), 10)
      assert.equal(outcome.success, true, outcome.error ?? '')
      assert.equal(outcome.data.topic, 'roofing maintenance')
      assert.equal(outcome.data.ideas.length, 10, 'exactly the requested quantity')
      assert.ok(outcome.data.ideas.every(idea => idea.title && idea.platforms.includes('facebook')), 'platform-grounded ideas')
      assert.match(outcome.data.research.summary, /leaks/)
      assert.equal(outcome.data.research.sources.length, 2, 'cited sources survive')
      assert.equal(createContentIdeasSkill.verify({ research: outcome.data.research, ideas: outcome.data.ideas, metadata: {} }).ok, true, 'output passes the skill contract')

      const markers = ['You are a thorough research assistant.', 'You are a social media strategist writing content ideas']
      for (const marker of markers) {
        assert.ok(completeCalls.some(prompt => prompt.includes(marker)), `chain executed ${marker.slice(0, 24)}…`)
      }
      const delegation = [...new Map(stub.requests
        .flatMap(r => r.messages)
        .filter(m => m.role === 'assistant' && m.tool_calls)
        .flatMap(m => m.tool_calls)
        .filter(call => call.function?.name === 'task')
        .map(call => [call.id, call])).values()]
        .map(call => JSON.parse(call.function.arguments).agent)
      assert.deepEqual(delegation, ['content-agent'], 'ContentAgent served the slice, never a second orchestration')
    } finally {
      await stopFlueRuntime()
      await closeServer(stub.server)
    }
  })

  it('fails loud with CONTENT_INCOMPLETE when the provider is down', async () => {
    const { runSliceB } = await import('../server/flue/slice-b.ts')
    const { stopFlueRuntime } = await import('../server/flue/runtime.ts')
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    try {
      const outcome = await runSliceB('roofing maintenance', ['facebook'], sliceContext({
        complete: scriptedComplete([], 'throw'),
        flueProvider: await startFlueProvider(`http://127.0.0.1:${port}/v1`),
      }), 10)
      assert.equal(outcome.success, false)
      assert.equal(outcome.code, 'CONTENT_INCOMPLETE', 'partial ideas never presented as complete')
    } finally {
      await stopFlueRuntime()
      await closeServer(stub.server)
    }
  })
})
