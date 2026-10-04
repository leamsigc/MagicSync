import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T06: first specialist subagents (PRD §7.1) — BusinessAgent, ResearchAgent,
 * StrategyAgent, ContentAgent as Flue subagents with structured results, plus
 * the single session-profile set replacing both superseded registries.
 */

const OWNER = 'spec-owner'
const BUSINESS = 'spec-business'
const MODEL_ID = 'stub-model'

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

function toolCallChunk(name, args) {
  return sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: `call_${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })
}

function textChunks(text) {
  return text.split(' ').map(word => `data: ${JSON.stringify(sseChunk({ role: 'assistant', content: `${word} ` }))}\n\n`).join('')
}

function doneChunk(usage) {
  return `data: ${JSON.stringify({ ...sseChunk({}, 'stop'), usage })}\n\n`
}

/**
 * Stub router: the parent turn (offers plan_lookup) delegates via `task` to
 * the specialist named in the user message; delegate turns use their own
 * mounts (business_lookup for BusinessAgent, model-only for the rest).
 */
function messageText(msg) {
  if (typeof msg?.content === 'string') return msg.content
  if (Array.isArray(msg?.content)) {
    return msg.content.filter(block => block?.type === 'text').map(block => block.text ?? '').join('\n')
  }
  return ''
}

function delegateTarget(payload) {
  const userMsg = payload.messages.find(m => m.role === 'user')
  const match = messageText(userMsg).match(/delegate to (\S+)/)
  return match ? match[1] : 'business-agent'
}

function startStubSseServer({ finalText, businessJson, delegateJson }) {
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
      res.write(doneChunk({ prompt_tokens: 21, completion_tokens: 7, total_tokens: 28 }))
    } else if (toolNames.includes('business_lookup')) {
      res.write(textChunks(businessJson))
      res.write(doneChunk({ prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 }))
    } else if (toolNames.includes('plan_lookup') && toolResults === 0) {
      res.write(`data: ${JSON.stringify(toolCallChunk('task', { agent: delegateTarget(payload), prompt: 'Do your task.' }))}\n\n`)
      res.write(doneChunk({ prompt_tokens: 21, completion_tokens: 7, total_tokens: 28 }))
    } else if (toolNames.includes('plan_lookup')) {
      res.write(textChunks(finalText))
      res.write(doneChunk({ prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 }))
    } else {
      res.write(textChunks(delegateJson))
      res.write(doneChunk({ prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 }))
    }
    res.write('data: [DONE]\n\n')
    res.end()
  })
  return { server, requests }
}

function closeServer(server) {
  return new Promise(resolve => server.close(() => resolve()))
}

async function startHarness(stubUrl, { agents, tenants }) {
  const { createProvider } = await import('@earendil-works/pi-ai')
  const { stream, streamSimple } = await import('@earendil-works/pi-ai/api/openai-completions')
  const { init } = await import('@flue/runtime')
  const { start } = await import('@flue/runtime/node')
  const provider = createProvider({
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
  const flue = await start({ agents, providers: [provider] })
  return { flue, init }
}

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'spec@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Spec Co' })
})

after(() => cleanupDb())

const tenant = () => ({ model: 'stub/stub-model', userId: OWNER, businessId: BUSINESS })

describe('specialist set (T06)', () => {
  it('is exactly the four specialists plus the transitional default', async () => {
    const { SPECIALIST_SESSION_PROFILES, DEFAULT_SESSION_PROFILE, findSpecialistProfile, isSpecialistProfileName } = await import('../server/flue/specialists.ts')
    assert.deepEqual(SPECIALIST_SESSION_PROFILES.map(p => p.name).sort(), ['business-agent', 'content-agent', 'research-agent', 'strategy-agent'])
    assert.equal(DEFAULT_SESSION_PROFILE.prompt, 'orchestrator', 'chat default preserved until T10')
    assert.equal(findSpecialistProfile('research-agent')?.prompt, 'research')
    assert.equal(findSpecialistProfile('content-agent')?.prompt, 'writePost')
    assert.equal(findSpecialistProfile('nope'), undefined)
    assert.equal(isSpecialistProfileName('strategy-agent'), true)
    assert.equal(isSpecialistProfileName('orchestrator'), false, 'old registry names are gone')
    assert.equal(isSpecialistProfileName('researcher'), false, 'old registry names are gone')
  })

  it('maps skills to covering specialists', async () => {
    const { specialistsForSkill } = await import('../server/flue/specialists.ts')
    assert.deepEqual(specialistsForSkill('research-business'), ['research-agent'])
    assert.deepEqual(specialistsForSkill('create-content-ideas'), ['content-agent'])
    assert.deepEqual(specialistsForSkill('identify-next-action'), ['business-agent'])
    assert.deepEqual(specialistsForSkill('create-marketing-plan'), ['strategy-agent'])
    assert.deepEqual(specialistsForSkill('nope'), [])
  })

  it('validates structured outputs and rejects unstructured replies', async () => {
    const { parseSpecialistOutput } = await import('../server/flue/specialists.ts')
    const business = parseSpecialistOutput('business-agent', '{"business":{"name":"Spec Co"},"nextStep":"Call!"}')
    assert.equal(business?.nextStep, 'Call!')
    assert.equal(parseSpecialistOutput('research-agent', 'just prose, no json'), null)
    assert.equal(parseSpecialistOutput('strategy-agent', '{"plan":[]}'), null, 'nextAction is required')
    const content = parseSpecialistOutput('content-agent', 'Here: {"ideas":[{"title":"T"}]} done')
    assert.equal(content?.ideas[0].title, 'T')
  })
})

describe('specialists run standalone in Flue (T06)', () => {
  it('BusinessAgent grounds in business_lookup and returns a structured result', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    const { parseSpecialistOutput } = await import('../server/flue/specialists.ts')
    const businessJson = JSON.stringify({ business: { name: 'Spec Co', industry: '' }, offers: [], opportunities: ['Local SEO'], nextStep: 'Claim the listing.' })
    const stub = startStubSseServer({ finalText: 'Start with claiming your listing.', businessJson, delegateJson: businessJson })
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    let harness
    try {
      const MagicSyncAgent = createMagicSyncAgent(tenant())
      harness = await startHarness(`http://127.0.0.1:${port}/v1`, { agents: [MagicSyncAgent] })
      const handle = harness.init(MagicSyncAgent, { id: 'spec-business-1' })
      const receipt = await handle.dispatch({ message: 'Please delegate to business-agent for this task.' })
      const reply = await handle.read(receipt)
      assert.ok(reply.text.trim().length > 0, 'parent answers after delegation')
      const delegateTurn = stub.requests.find(r => (r.tools ?? []).some(t => (t.function?.name ?? t.name) === 'business_lookup'))
      assert.ok(delegateTurn, 'delegate executed with its own tool mount')
      const offered = (delegateTurn.tools ?? []).map(tool => tool.function?.name ?? tool.name)
      assert.ok(offered.includes('business_lookup'), 'delegate mounts its focused tool')
      assert.ok(!offered.includes('plan_lookup'), 'delegate does not inherit the parent mount')
      const toolResultMsg = stub.requests.flatMap(r => r.messages).find(m => m.role === 'tool')
      assert.ok(JSON.stringify(toolResultMsg).includes('Spec Co'), 'real business row grounded the run')
      assert.ok(parseSpecialistOutput('business-agent', businessJson), 'delegate result shape validates')
    } finally {
      await harness.flue.stop()
      await closeServer(stub.server)
    }
  })

  it('ResearchAgent, StrategyAgent, ContentAgent return validated results with no tools', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    const { parseSpecialistOutput } = await import('../server/flue/specialists.ts')
    const cases = [
      ['research-agent', JSON.stringify({ summary: 'S', findings: ['F'], sources: [], gaps: [] })],
      ['strategy-agent', JSON.stringify({ opportunities: [{ title: 'O' }], plan: ['P'], nextAction: 'Do it.' })],
      ['content-agent', JSON.stringify({ ideas: [{ title: 'T', brief: 'B', platforms: ['instagram'] }] })],
    ]
    for (const [id, scripted] of cases) {
      const stub = startStubSseServer({ finalText: 'Wrapped up.', businessJson: '{}', delegateJson: scripted })
      await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
      const port = stub.server.address().port
      let harness
      try {
        const MagicSyncAgent = createMagicSyncAgent(tenant())
        harness = await startHarness(`http://127.0.0.1:${port}/v1`, { agents: [MagicSyncAgent] })
        const handle = harness.init(MagicSyncAgent, { id: `spec-${id}-1` })
        const receipt = await handle.dispatch({ message: `Please delegate to ${id} for this task.` })
        const reply = await handle.read(receipt)
        assert.ok(reply.text.trim().length > 0, `${id} delegation completes`)
        const delegateTurn = stub.requests.find(r => !(r.tools ?? []).some(t => (t.function?.name ?? t.name) === 'plan_lookup' || (t.function?.name ?? t.name) === 'business_lookup'))
        assert.ok(delegateTurn, `${id} executed a turn with neither parent nor business mount`)
        assert.ok(parseSpecialistOutput(id, scripted), `${id} structured result validates`)
      } finally {
        await harness.flue.stop()
        await closeServer(stub.server)
      }
    }
  })

  it('MagicSyncAgent delegates to a specialist through useSubagent', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    const { parseSpecialistOutput } = await import('../server/flue/specialists.ts')
    const businessJson = JSON.stringify({ business: { name: 'Spec Co', industry: '' }, offers: [], opportunities: [], nextStep: 'Claim it.' })
    const stub = startStubSseServer({ finalText: 'Start with claiming your listing.', businessJson, delegateJson: businessJson })
    await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
    const port = stub.server.address().port
    let harness
    try {
      const MagicSyncAgent = createMagicSyncAgent(tenant())
      harness = await startHarness(`http://127.0.0.1:${port}/v1`, { agents: [MagicSyncAgent] })
      const handle = harness.init(MagicSyncAgent, { id: 'spec-delegation-1' })
      const receipt = await handle.dispatch({ message: 'Help me get more customers.' })
      const reply = await handle.read(receipt)
      assert.ok(reply.text.trim().length > 0, 'parent answers after delegation')
      const taskCalls = stub.requests.flatMap(r => (r.messages ?? [])
        .filter(m => m.role === 'assistant' && m.tool_calls)
        .flatMap(m => m.tool_calls))
      const delegation = taskCalls.find(call => call.function?.name === 'task')
      assert.ok(delegation, 'parent delegated through the task tool')
      assert.equal(JSON.parse(delegation.function.arguments).agent, 'business-agent', 'delegated to the business specialist')
      const delegateTurns = stub.requests.filter(r => (r.tools ?? []).some(t => (t.function?.name ?? t.name) === 'business_lookup'))
      assert.ok(delegateTurns.length >= 1, 'delegate executed with its own tool mount')
      assert.ok(parseSpecialistOutput('business-agent', businessJson), 'delegate result shape validates')
    } finally {
      await harness.flue.stop()
      await closeServer(stub.server)
    }
  })
})
