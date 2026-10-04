import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T11 small-model optimization pass (~24B target): prove by measurement that
 * a representative task neither injects the full 37-tool catalog nor all
 * project context, stays bounded, and keeps deterministic zero-cost routing.
 */

const OWNER = 'small-owner'
const BUSINESS = 'small-business'
const OTHER_BUSINESS = 'small-other'
const MODEL_ID = 'stub-model'

const MAX_TOOLS_PER_TURN = 6
const MAX_REQUEST_BYTES = 32_768
const MAX_SLICE_REQUESTS = 20
const MAX_DESCRIPTION_CHARS = 140

let cleanupDb

function sseChunk(delta, finishReason = null) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

function toolCallChunk(name, args, seq) {
  return sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: `call_${name}_${seq}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })
}

function textChunks(text) {
  return text.split(' ').map(word => `data: ${JSON.stringify(sseChunk({ role: 'assistant', content: `${word} ` }))}\n\n`).join('')
}

const COMPLETIONS = {
  analyze: JSON.stringify({ analysis: 'A', strengths: ['S'], gaps: [], opportunityHypotheses: [] }),
  competitors: JSON.stringify({ summary: 'S', competitors: [{ name: 'R', positioning: '', evidence: 'E' }], sources: [{ label: 'L' }] }),
  discover: JSON.stringify({ summary: 'S', opportunities: [{ id: 'o1', title: 'T1', rationale: 'R', impact: 'high', effort: 'low', priority: 1 }] }),
  plan: JSON.stringify({ planTitle: 'P', summary: 'S', horizon: '30d', phases: [{ name: 'W1', focus: 'F', actions: [{ title: 'Do the thing now', description: 'D' }] }] }),
  identify: JSON.stringify({ nextAction: { title: 'T', why: 'W', how: 'How to do it now' }, alternatives: [] }),
}

function scriptedComplete() {
  return async ({ prompt }) => {
    const marker = ['# Research Competitors', '# Create Marketing Plan', '# Discover Opportunities', '# Identify Next Action', '# Analyze Business'].find(t => prompt.includes(t))
    if (marker === '# Research Competitors') return COMPLETIONS.competitors
    if (marker === '# Create Marketing Plan') return COMPLETIONS.plan
    if (marker === '# Discover Opportunities') return COMPLETIONS.discover
    if (marker === '# Identify Next Action') return COMPLETIONS.identify
    if (marker === '# Analyze Business') return COMPLETIONS.analyze
    throw new Error('unmatched prompt')
  }
}

const scriptedLangsearch = async () => ({
  success: true,
  data: { results: [{ title: 'R', url: 'https://r.example', text: 'T' }] },
})

const DELEGATION_ORDER = ['business-agent', 'research-agent', 'strategy-agent', 'business-agent']

function startStubSseServer() {
  const requests = []
  let seq = 0
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    requests.push(payload)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const toolNames = (payload.tools ?? []).map(tool => tool.function?.name ?? tool.name)
    const toolResults = payload.messages.filter(m => m.role === 'tool').length
    seq += 1
    const call = (name, args) => `data: ${JSON.stringify(toolCallChunk(name, args, seq))}\n\n`
    if (toolNames.includes('business_lookup') && toolResults === 0) {
      res.write(call('business_lookup', {}))
    } else if (toolNames.includes('analyze-business') && toolResults === 1) {
      res.write(call('analyze-business', {}))
    } else if (toolNames.includes('analyze-business') && toolResults === 2) {
      res.write(call('identify-next-action', {}))
    } else if (toolNames.includes('research-competitors') && toolResults === 0) {
      res.write(call('research-competitors', { topic: 't' }))
    } else if (toolNames.includes('discover-opportunities') && toolResults === 0) {
      res.write(call('discover-opportunities', {}))
    } else if (toolNames.includes('discover-opportunities') && toolResults === 1) {
      res.write(call('create-marketing-plan', { horizon: '30d' }))
    } else if (toolNames.includes('plan_lookup') && toolResults < DELEGATION_ORDER.length) {
      res.write(call('task', { agent: DELEGATION_ORDER[toolResults], prompt: 'Go.' }))
    } else {
      res.write(textChunks('Wrapped up for measurement.'))
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
    id: 'stub', name: 'Stub', baseUrl: stubUrl,
    auth: { apiKey: { name: 'k', resolve: () => Promise.resolve({ auth: { apiKey: 'stub-key' }, source: 'stub' }) } },
    models: [{
      id: MODEL_ID, name: 'S', api: 'openai-completions', provider: 'stub', baseUrl: stubUrl,
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
  await insertUser(init.db, { id: OWNER, email: 'small@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Small Co' })
  await insertBusiness(init.db, { id: OTHER_BUSINESS, userId: OWNER, name: 'Unrelated Other Co' })
})

after(() => cleanupDb())

describe('small-model budgets (T11)', () => {
  it('short catalog lines stay mounted: tool descriptions fit a small window', async () => {
    const { FLUE_SKILLS } = await import('../server/flue/skills.ts')
    for (const entry of FLUE_SKILLS) {
      assert.ok(entry.definition.description.length <= 200, `${entry.id} description short`)
    }
    const { createSkillTools } = await import('../server/flue/skill-tools.ts')
    const tools = createSkillTools({
      userId: OWNER, businessId: BUSINESS, goal: 'g', systemContext: '',
      complete: async () => '{}', previous: {},
    })
    for (const [id, tool] of Object.entries(tools)) {
      assert.ok(tool.description.length <= MAX_DESCRIPTION_CHARS, `${id} tool description short`)
    }
  })

  it('every per-agent mount fits the turn budget (T28)', async () => {
    const { MAX_TOOLS_PER_TURN, CHAT_AGENT_MOUNT, offeredToolCount, mountAgentTools } = await import('../server/agent/tools/mounts.ts')
    const { SPECIALIST_SESSION_PROFILES, DEFAULT_SESSION_PROFILE, createSpecialistSubagents } = await import('../server/flue/specialists.ts')

    const mounts = new Map([
      ...SPECIALIST_SESSION_PROFILES.map(profile => [profile.name, profile.tools]),
      [DEFAULT_SESSION_PROFILE.name, DEFAULT_SESSION_PROFILE.tools],
    ])
    for (const [agent, ourTools] of mounts) {
      assert.ok(
        offeredToolCount(ourTools) <= MAX_TOOLS_PER_TURN,
        `${agent} offers ${offeredToolCount(ourTools)} tools (${ourTools.length} + framework), budget ${MAX_TOOLS_PER_TURN}`,
      )
    }
    assert.equal(mounts.get(DEFAULT_SESSION_PROFILE.name).length, CHAT_AGENT_MOUNT.length, 'the chat mount is the orchestrator profile mount')

    // The guard is what turns a bag into a mount: prove it on the real bag.
    const { createAgentToolBag } = await import('../server/agent/tools/mounts.ts')
    const { createAgentToolContext } = await import('../server/agent/tool-context.ts')
    const bag = createAgentToolBag(createAgentToolContext({ userId: OWNER, businessId: BUSINESS }))
    assert.ok(Object.keys(bag).length > 30, `the whole bag is ${Object.keys(bag).length} tools`)
    for (const [agent, ourTools] of mounts) {
      const mounted = mountAgentTools(Object.values(bag), { agent, allowedTools: ourTools })
      assert.deepEqual([...mounted.map(tool => tool.name)].sort(), [...ourTools].sort(), `${agent} mounts exactly its allowlist`)
    }
    assert.ok(createSpecialistSubagents, 'the delegate factory still exists')
  })

  it('a representative slice run stays within tool, size, and turn budgets', async () => {
    const { runSliceA } = await import('../server/flue/slice-a.ts')
    const { stopFlueRuntime } = await import('../server/flue/runtime.ts')
    const stub = startStubSseServer()
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    try {
      const outcome = await runSliceA('Help me get more customers.', {
        userId: OWNER,
        businessId: BUSINESS,
        systemContext: '',
        complete: scriptedComplete(),
        langsearch: scriptedLangsearch,
        langsearchKey: 'test-key-stub',
        flueProvider: await startFlueProvider(`http://127.0.0.1:${port}/v1`),
        flueModel: 'stub/stub-model',
      })
      assert.equal(outcome.success, true, outcome.error ?? '')

      assert.ok(stub.requests.length <= MAX_SLICE_REQUESTS, `bounded turns (${stub.requests.length} requests)`)
      for (const [index, request] of stub.requests.entries()) {
        const offered = (request.tools ?? []).map(tool => tool.function?.name ?? tool.name)
        assert.ok(offered.length <= MAX_TOOLS_PER_TURN, `turn ${index} mounts ${offered.length}, never the 37-tool catalog`)
        const bytes = JSON.stringify(request).length
        assert.ok(bytes <= MAX_REQUEST_BYTES, `turn ${index} payload ${bytes}B within budget`)
        const serialized = JSON.stringify(request)
        assert.ok(!serialized.includes('Unrelated Other Co'), `turn ${index} carries no other-business context`)
      }
    } finally {
      await stopFlueRuntime()
      await closeServer(stub.server)
    }
  })

  it('deterministic routing short-circuits with zero model calls', async () => {
    await import('../server/capabilities/goal.ts')
    const { runCapability } = await import('../server/capabilities/registry.ts')
    let modelCalls = 0
    const outcome = await runCapability('goal.plan', { goal: 'Help me get more customers' }, {
      userId: OWNER,
      businessId: BUSINESS,
      complete: async () => { modelCalls += 1; return '{}' },
      systemContext: '',
    })
    assert.equal(outcome.ok, true)
    assert.equal(modelCalls, 0, 'routed goal costs zero model calls')
  })
})
