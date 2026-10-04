import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T08 vertical slice A — STOP GATE (PRD §8.1): "Help me get more customers."
 * MagicSyncAgent → BusinessAgent → ResearchAgent → StrategyAgent with the
 * five skills, chained through one evidence store, rendered in plain
 * language. Hermetic: Flue turns via SSE stub, skill model calls via a
 * scripted completion, LangSearch via an injected client. No network.
 */

const OWNER = 'slice-owner'
const BUSINESS = 'slice-business'
const MODEL_ID = 'stub-model'

let cleanupDb

const COMPLETIONS = {
  analyze: JSON.stringify({
    analysis: 'Spec Co fixes roofs; reviews praise speed.',
    strengths: ['Fast response times'],
    gaps: ['No maintenance plans'],
    opportunityHypotheses: ['Sell seasonal checkups'],
  }),
  competitors: JSON.stringify({
    summary: 'Two rivals compete on price; none offer maintenance.',
    competitors: [{ name: 'Rival Roofing', positioning: 'Cheapest bids', evidence: 'Rival site lists prices' }],
    sources: [{ label: 'Rival site', url: 'https://rival.example' }],
  }),
  discover: JSON.stringify({
    summary: 'Maintenance gap is the opening.',
    opportunities: [
      { id: 'o1', title: 'Seasonal roof checkups', rationale: 'No rival offers them', impact: 'high', effort: 'low', priority: 1 },
      { id: 'o2', title: 'Gutter cleaning add-on', rationale: 'Pairs with checkups', impact: 'medium', effort: 'low', priority: 2 },
      { id: 'o3', title: 'Referral rewards', rationale: 'Happy owners refer', impact: 'medium', effort: 'low', priority: 3 },
    ],
  }),
  plan: JSON.stringify({
    planTitle: '30-day growth plan',
    summary: 'Launch checkups, then attach add-ons.',
    horizon: '30d',
    phases: [{ name: 'Week 1-2', focus: 'Offer', actions: [{ title: 'Publish the checkup offer', description: 'Landing page plus posts' }] }],
  }),
  identify: JSON.stringify({
    nextAction: { title: 'Publish the seasonal checkup offer', why: 'Highest impact, lowest effort', how: 'Ship the landing page and announce it this week' },
    alternatives: [],
  }),
}

function scriptedComplete(calls, broken = null) {
  return async ({ system, prompt }) => {
    calls.push(prompt)
    const marker = [
      '# Research Competitors',
      '# Create Marketing Plan',
      '# Discover Opportunities',
      '# Identify Next Action',
      '# Analyze Business',
    ].find(title => prompt.includes(title))
    if (broken === 'discover' && marker === '# Discover Opportunities') return 'not json at all'
    if (marker === '# Research Competitors') return COMPLETIONS.competitors
    if (marker === '# Create Marketing Plan') return COMPLETIONS.plan
    if (marker === '# Discover Opportunities') return COMPLETIONS.discover
    if (marker === '# Identify Next Action') return COMPLETIONS.identify
    if (marker === '# Analyze Business') return COMPLETIONS.analyze
    throw new Error(`unmatched skill prompt: ${prompt.slice(0, 120)}`)
  }
}

const scriptedLangsearch = async () => ({
  success: true,
  data: { results: [{ title: 'Rival Roofing', url: 'https://rival.example', text: 'Cheapest roof bids in town' }] },
})

function sseChunk(delta, finishReason = null) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

let callSeq = 0

function toolCallChunk(name, args) {
  callSeq += 1
  return sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: `call_${name}_${callSeq}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })
}

function textChunks(text) {
  return text.split(' ').map(word => `data: ${JSON.stringify(sseChunk({ role: 'assistant', content: `${word} ` }))}\n\n`).join('')
}

function doneChunk() {
  return `data: ${JSON.stringify(sseChunk({}, 'stop'))}\n\n`
}

/** Parent turns delegate in slice order; delegate turns run their skill tools. */
const DELEGATION_ORDER = ['business-agent', 'research-agent', 'strategy-agent', 'business-agent']

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
    if (toolNames.includes('business_lookup') && toolResults === 0) {
      res.write(`data: ${JSON.stringify(toolCallChunk('business_lookup', {}))}\n\n`)
    } else if (toolNames.includes('analyze-business') && toolResults === 1) {
      res.write(`data: ${JSON.stringify(toolCallChunk('analyze-business', {}))}\n\n`)
    } else if (toolNames.includes('analyze-business') && toolResults === 2) {
      res.write(`data: ${JSON.stringify(toolCallChunk('identify-next-action', {}))}\n\n`)
    } else if (toolNames.includes('research-competitors') && toolResults === 0) {
      res.write(`data: ${JSON.stringify(toolCallChunk('research-competitors', { topic: 'roofing' }))}\n\n`)
    } else if (toolNames.includes('discover-opportunities') && toolResults === 0) {
      res.write(`data: ${JSON.stringify(toolCallChunk('discover-opportunities', {}))}\n\n`)
    } else if (toolNames.includes('discover-opportunities') && toolResults === 1) {
      res.write(`data: ${JSON.stringify(toolCallChunk('create-marketing-plan', { horizon: '30d' }))}\n\n`)
    } else if (toolNames.includes('plan_lookup') && toolResults < DELEGATION_ORDER.length) {
      res.write(`data: ${JSON.stringify(toolCallChunk('task', { agent: DELEGATION_ORDER[toolResults], prompt: 'Do your slice task.' }))}\n\n`)
    } else {
      res.write(textChunks('Slice work is flowing along.'))
    }
    res.write(doneChunk())
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
  await insertUser(init.db, { id: OWNER, email: 'slice@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Spec Co' })
})

after(() => cleanupDb())

function sliceContext(overrides = {}) {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    systemContext: '',
    complete: scriptedComplete([]),
    langsearch: scriptedLangsearch,
    langsearchKey: 'test-key-stub',
    flueModel: 'stub/stub-model',
    ...overrides,
  }
}

describe('vertical slice A end-to-end (T08 STOP GATE)', () => {
  it('turns "Help me get more customers." into opportunities, a plan, and one next step', async () => {
    const { runSliceA } = await import('../server/flue/slice-a.ts')
    const { stopFlueRuntime } = await import('../server/flue/runtime.ts')
    const completeCalls = []
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    try {
      const outcome = await runSliceA('Help me get more customers.', sliceContext({
        complete: scriptedComplete(completeCalls),
        flueProvider: await startFlueProvider(`http://127.0.0.1:${port}/v1`),
      }))
      const markers = ['# Analyze Business', '# Research Competitors', '# Discover Opportunities', '# Create Marketing Plan', '# Identify Next Action']
      for (const marker of markers) {
        assert.ok(completeCalls.some(prompt => prompt.includes(marker)), `chain executed ${marker}`)
      }
      assert.equal(outcome.success, true, outcome.error ?? '')
      assert.equal(outcome.data.opportunities.length, 3)
      assert.equal(outcome.data.opportunities[0].title, 'Seasonal roof checkups')
      assert.equal(outcome.data.nextStep.title, 'Publish the seasonal checkup offer')
      assert.equal(outcome.data.plan.title, '30-day growth plan')
      assert.ok(outcome.data.plan.actions.length >= 1)
      assert.equal(outcome.data.showPlanAction, true)
      assert.match(outcome.data.reply, /I found 3 good opportunities\./)
      assert.match(outcome.data.reply, /1\. Seasonal roof checkups/)
      assert.match(outcome.data.reply, /I think you should start with #1\./)
      assert.ok(!outcome.data.reply.match(/agent|skill|tool|model|Flue/i), 'plain language only')

      const discoverPrompt = completeCalls.find(prompt => prompt.includes('# Discover Opportunities'))
      assert.ok(discoverPrompt.includes('analyze-business'), 'opportunities built on analysis evidence')
      assert.ok(discoverPrompt.includes('research-competitors'), 'opportunities built on competitor evidence')

      const taskCalls = [...new Map(stub.requests
        .flatMap(r => r.messages)
        .filter(m => m.role === 'assistant' && m.tool_calls)
        .flatMap(m => m.tool_calls)
        .filter(call => call.function?.name === 'task')
        .map(call => [call.id, call])).values()]
      const delegation = taskCalls.map(call => JSON.parse(call.function.arguments).agent)
      assert.deepEqual(delegation, DELEGATION_ORDER, 'slice order matches §8.1')
      const toolResult = stub.requests.flatMap(r => r.messages).find(m => m.role === 'tool')
      assert.ok(JSON.stringify(toolResult).includes('Spec Co'), 'business_lookup grounded the run in the real profile')
    } finally {
      await stopFlueRuntime()
      await closeServer(stub.server)
    }
  })

  it('fails loud with GOAL_INCOMPLETE when opportunities cannot be produced', async () => {
    const { runSliceA } = await import('../server/flue/slice-a.ts')
    const { stopFlueRuntime } = await import('../server/flue/runtime.ts')
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    try {
      const outcome = await runSliceA('Help me get more customers.', sliceContext({
        complete: scriptedComplete([], 'discover'),
        flueProvider: await startFlueProvider(`http://127.0.0.1:${port}/v1`),
      }))
      assert.equal(outcome.success, false)
      assert.equal(outcome.code, 'GOAL_INCOMPLETE', 'partial output never presented as complete')
    } finally {
      await stopFlueRuntime()
      await closeServer(stub.server)
    }
  })
})
