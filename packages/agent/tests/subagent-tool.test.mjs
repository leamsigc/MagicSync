import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T27 — subagent delegation on Flue.
 *
 * The pi-agent-core delegation loop (`server/agent/tools/subagent.tools.ts`) is
 * deleted. Delegation now runs through Flue's built-in `task` tool against the
 * `SPECIALIST_SESSION_PROFILES` catalog declared by
 * `createSpecialistSubagents`. Each preserved pi behaviour has a test here:
 * unknown agent name, bounded turns (+ `truncated`), isolated transcript, tool
 * allowlist, forced skills, and the carousel payload passthrough.
 */

const OWNER = 'subagent-owner'
const BUSINESS = 'subagent-business'
const MODEL_ID = 'stub-model'

/** Framework-owned tools Flue always appends — never part of a profile. */
const FRAMEWORK_TOOLS = ['task', 'activate_skill']

const CAROUSEL = {
  artifactId: 'art_9f2',
  version: 3,
  slides: [{ index: 1, title: 'Hook' }, { index: 2, title: 'Proof' }],
}

let cleanupDb
let createAgentTools
let createAgentToolContext

// ---------------------------------------------------------------- stub helpers

function sseChunk(delta, finishReason = null) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

function messageText(msg) {
  if (typeof msg?.content === 'string') return msg.content
  if (!Array.isArray(msg?.content)) return ''
  return msg.content.filter(block => block?.type === 'text').map(block => block.text ?? '').join('\n')
}

function systemText(payload) {
  return payload.messages.filter(m => m.role === 'system').map(messageText).join('\n')
}

function offeredTools(payload) {
  return (payload.tools ?? []).map(tool => tool.function?.name ?? tool.name)
}

function mountedTools(payload) {
  return offeredTools(payload).filter(name => !FRAMEWORK_TOOLS.includes(name))
}

function toolResults(payload) {
  return payload.messages.filter(m => m.role === 'tool')
}

function toolResultText(payload) {
  return toolResults(payload).map(messageText).join('\n')
}

function assistantToolCalls(payload) {
  return payload.messages
    .filter(m => m.role === 'assistant' && m.tool_calls)
    .flatMap(m => m.tool_calls)
}

function toolCallTurn(name, args) {
  return `data: ${JSON.stringify(sseChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: `call_${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }))}\n\n`
    + finishTurn('tool_calls')
}

function textTurn(text) {
  return `data: ${JSON.stringify(sseChunk({ role: 'assistant', content: text }))}\n\n` + finishTurn('stop')
}

function finishTurn(reason) {
  return `data: ${JSON.stringify({ ...sseChunk({}, reason), usage: { prompt_tokens: 21, completion_tokens: 7, total_tokens: 28 } })}\n\n`
}

/** Scripted OpenAI-compatible SSE server: `respond(payload)` returns the body. */
function startStub(respond) {
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    requests.push(payload)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    res.write(respond(payload))
    res.write('data: [DONE]\n\n')
    res.end()
  })
  return { server, requests }
}

function closeStub(server) {
  return new Promise(resolve => server.close(() => resolve()))
}

function stubTool(name, output) {
  return defineTool({
    name,
    description: `Test seam tool ${name}.`,
    input: v.object({ note: v.optional(v.string(), '') }),
    run: async () => ({ output: typeof output === 'function' ? output() : output }),
  })
}

/** Boot Flue with the stub provider, run one parent submission, collect the wire. */
async function runAgent(Parent, { respond, id }) {
  const { createProvider } = await import('@earendil-works/pi-ai')
  const { stream, streamSimple } = await import('@earendil-works/pi-ai/api/openai-completions')
  const { init } = await import('@flue/runtime')
  const { start } = await import('@flue/runtime/node')
  const stub = startStub(respond)
  await new Promise(resolve => stub.server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${stub.server.address().port}/v1`
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
  const flue = await start({ agents: [Parent], providers: [provider] })
  let reply
  try {
    const handle = init(Parent, { id })
    reply = await handle.read(await handle.dispatch({ message: 'Secret-parent-briefing-9931. Delegate this.' }))
  } finally {
    await flue.stop()
    await closeStub(stub.server)
  }
  return { reply, requests: stub.requests }
}

/** A request issued by a delegate: no parent mount, at least one profile tool. */
function isDelegateRequest(payload, profileTool) {
  return !offeredTools(payload).includes('plan_lookup') && offeredTools(payload).includes(profileTool)
}

function delegateRequests(requests, profileTool) {
  return requests.filter(payload => isDelegateRequest(payload, profileTool))
}

/** Every tool result the parent conversation carries, in wire order. */
function parentToolResults(requests) {
  return requests
    .filter(payload => offeredTools(payload).includes('plan_lookup'))
    .flatMap(payload => toolResults(payload))
    .map(messageText)
}

function parentRequests(requests) {
  return requests.filter(payload => offeredTools(payload).includes('plan_lookup'))
}

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'subagent@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Subagent Co' })
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
})

after(() => cleanupDb())

// -------------------------------------------------------------------- the set

describe('subagent delegation on Flue (T27)', () => {
  it('registers no pi subagent tool — the module is gone', () => {
    const tools = createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS }))
    assert.equal(tools.find(entry => entry.name === 'subagent'), undefined)
    assert.equal(tools.find(entry => entry.name === 'task'), undefined, 'task is Flue-owned, never in our tool set')
  })

  it('declares the four SPECIALIST_SESSION_PROFILES as the task catalog', async () => {
    const { SPECIALIST_SESSION_PROFILES } = await import('../server/flue/specialists.ts')
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')

    const researchAnswer = '{"summary":"S","findings":[],"sources":[],"gaps":[],"truncated":false}'
    const { requests } = await runAgent(
      createMagicSyncAgent({ model: 'stub/stub-model', systemContext: '' }),
      {
        id: 'subagent-catalog-1',
        respond: (payload) => {
          if (mountedTools(payload).includes('plan_lookup')) {
            return toolResults(payload).length === 0
              ? toolCallTurn('task', { agent: 'research-agent', prompt: 'Research the market.' })
              : textTurn('Answered with the research result.')
          }
          return textTurn(researchAnswer)
        },
      },
    )

    const roster = systemText(parentRequests(requests)[0])
    for (const profile of SPECIALIST_SESSION_PROFILES) {
      assert.ok(roster.includes(`**${profile.name}**`), `${profile.name} is catalogued on the parent`)
      assert.ok(roster.includes(profile.description), `${profile.name} description reaches the model`)
    }
    const delegation = assistantToolCalls(parentRequests(requests)[1]).find(call => call.function?.name === 'task')
    assert.ok(delegation, 'parent delegated through Flue\'s built-in task tool')
    assert.equal(JSON.parse(delegation.function.arguments).agent, 'research-agent')
    assert.deepEqual(offeredTools(parentRequests(requests)[0]).sort(), ['plan_lookup', 'task'], 'no subagent tool is mounted')
  })

  it('answers an unknown or retired agent name with a clear error listing every available agent', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    for (const bad of ['nope', 'writer']) {
      const { requests } = await runAgent(
        createMagicSyncAgent({ model: 'stub/stub-model', systemContext: '' }),
        {
          id: `subagent-unknown-${bad}`,
          respond: (payload) => {
            if (!mountedTools(payload).includes('plan_lookup')) return textTurn('unused')
            return toolResults(payload).length === 0
              ? toolCallTurn('task', { agent: bad, prompt: 'x' })
              : textTurn('Stopped.')
          },
        },
      )
      const refusal = parentToolResults(requests).join('\n')
      assert.match(refusal, new RegExp(`Subagent "${bad}" is not declared`), 'typed miss names the bad agent')
      const listed = refusal.match(/Available subagents: ([^.]+)\./)?.[1] ?? ''
      assert.deepEqual(
        listed.split(', ').sort(),
        ['business-agent', 'content-agent', 'research-agent', 'strategy-agent'],
        'the miss lists every catalogued agent',
      )
    }
  })

  it('runs the delegate in an isolated transcript', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    const { requests } = await runAgent(
      createMagicSyncAgent({ model: 'stub/stub-model', systemContext: '', tools: { web_search: stubTool('web_search', { hits: 1 }) } }),
      {
        id: 'subagent-isolation-1',
        respond: (payload) => {
          if (mountedTools(payload).includes('plan_lookup')) {
            return toolResults(payload).length === 0
              ? toolCallTurn('task', { agent: 'research-agent', prompt: 'Research the market.' })
              : textTurn('Done.')
          }
          return textTurn('{"summary":"S","findings":[],"sources":[],"gaps":[],"truncated":false}')
        },
      },
    )
    const delegates = delegateRequests(requests, 'web_search')
    assert.ok(delegates.length >= 1, 'the delegate ran a turn')
    for (const payload of delegates) {
      assert.deepEqual(payload.messages.map(m => m.role).slice(0, 2), ['system', 'user'], 'fresh context: only its own prompt')
      const briefing = JSON.stringify(payload.messages)
      assert.ok(!briefing.includes('Secret-parent-briefing-9931'), 'delegate cannot see the parent conversation')
    }
    assert.ok(parentToolResults(requests).some(text => text.includes('"summary"')), 'only the delegate answer reaches the parent')
  })

  it('mounts only the profile allowlist and the profile forced skills', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    const bag = {
      web_search: stubTool('web_search', { hits: 1 }),
      scrape_url: stubTool('scrape_url', { text: 'page' }),
      retrieve: stubTool('retrieve', { chunks: [] }),
      research_topic: stubTool('research_topic', { hash: 'h' }),
      write_post: stubTool('write_post', { caption: 'draft' }),
      board_add_cards: stubTool('board_add_cards', { created: 1 }),
      generate_carousel: stubTool('generate_carousel', CAROUSEL),
    }
    const { requests } = await runAgent(
      createMagicSyncAgent({ model: 'stub/stub-model', systemContext: '', tools: bag }),
      {
        id: 'subagent-allowlist-1',
        respond: (payload) => {
          if (mountedTools(payload).includes('plan_lookup')) {
            return toolResults(payload).length === 0
              ? toolCallTurn('task', { agent: 'research-agent', prompt: 'Research the market.' })
              : textTurn('Done.')
          }
          return textTurn('{"summary":"S","findings":[],"sources":[],"gaps":[],"truncated":false}')
        },
      },
    )
    const delegate = delegateRequests(requests, 'web_search')[0]
    // T28: the profile allowlist is also the delegate's Flue mount, sized so the
    // turn stays inside MAX_TOOLS_PER_TURN once Flue adds task + activate_skill.
    const { MAX_TOOLS_PER_TURN, offeredToolCount } = await import('../server/agent/tools/mounts.ts')
    const { SPECIALIST_SESSION_PROFILES } = await import('../server/flue/specialists.ts')
    const profile = SPECIALIST_SESSION_PROFILES.find(entry => entry.name === 'research-agent')
    assert.deepEqual(profile.tools, ['web_search', 'scrape_url', 'retrieve'])
    assert.ok(
      offeredToolCount(profile.tools) <= MAX_TOOLS_PER_TURN,
      `${offeredToolCount(profile.tools)} tools offered, budget ${MAX_TOOLS_PER_TURN}`,
    )
    assert.deepEqual(mountedTools(delegate).sort(), [...profile.tools].sort(), 'exactly profile.tools, nothing else')
    assert.ok(!offeredTools(delegate).includes('plan_lookup'), 'the delegate never inherits the parent mount')
    assert.ok(offeredTools(delegate).length <= MAX_TOOLS_PER_TURN, 'the wire mount respects the budget')
    const skills = systemText(delegate)
    for (const slug of ['langsearch', 'social-research']) {
      assert.ok(skills.includes(`**${slug}**`), `${slug} is forced onto the delegate`)
    }
  })

  it('bounds the delegate at SUBAGENT_MAX_TURNS and reports truncated: true', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    const { SUBAGENT_MAX_TURNS, TURN_BUDGET_CODE } = await import('../server/flue/delegation.ts')
    let executed = 0
    const counting = stubTool('web_search', () => { executed += 1; return { hits: executed } })

    const { requests } = await runAgent(
      createMagicSyncAgent({ model: 'stub/stub-model', systemContext: '', tools: { web_search: counting } }),
      {
        id: 'subagent-budget-1',
        respond: (payload) => {
          if (mountedTools(payload).includes('plan_lookup')) {
            return toolResults(payload).length === 0
              ? toolCallTurn('task', { agent: 'research-agent', prompt: 'Research forever.' })
              : textTurn('Done.')
          }
          return toolResultText(payload).includes(TURN_BUDGET_CODE)
            ? textTurn('{"summary":"partial","findings":[],"sources":[],"gaps":[],"truncated":true}')
            : toolCallTurn('web_search', { note: 'again' })
        },
      },
    )

    assert.equal(executed, SUBAGENT_MAX_TURNS, `only ${SUBAGENT_MAX_TURNS} tool turns ran`)
    const delegate = delegateRequests(requests, 'web_search')
    const refused = delegate.filter(payload => toolResultText(payload).includes(TURN_BUDGET_CODE))
    assert.ok(refused.length >= 1, 'the refusal reached the delegate')
    assert.match(toolResultText(refused.at(-1)), /"truncated":true/, 'the refusal reports truncation')
    assert.match(parentToolResults(requests).join('\n'), /"truncated":true/, 'truncated surfaces in the delegation result')
  })

  it('passes a carousel tool payload through to the parent with artifactId and version', async () => {
    const { createMagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
    // No profile allowlists `generate_carousel`, so the payload rides out on the
    // content delegate's `write_post` — the rule is "any tool result with slides".
    const bag = { write_post: stubTool('write_post', CAROUSEL) }
    const { requests } = await runAgent(
      createMagicSyncAgent({ model: 'stub/stub-model', systemContext: '', tools: bag }),
      {
        id: 'subagent-carousel-1',
        respond: (payload) => {
          if (mountedTools(payload).includes('plan_lookup')) {
            return toolResults(payload).length === 0
              ? toolCallTurn('task', { agent: 'content-agent', prompt: 'Design the carousel.' })
              : textTurn('Done.')
          }
          return toolResults(payload).length === 0
            ? toolCallTurn('write_post', { note: 'deck' })
            : textTurn(JSON.stringify({ ideas: [{ title: 'T', brief: 'B', platforms: ['instagram'] }], truncated: false, carousel: CAROUSEL }))
        },
      },
    )

    const envelope = delegateRequests(requests, 'write_post').flatMap(payload => toolResults(payload)).map(messageText).join('\n')
    assert.match(envelope, /"passthrough":"carousel"/, 'the carousel tool result is wrapped for passthrough')
    assert.ok(envelope.includes(CAROUSEL.artifactId) && envelope.includes('"version":3'), 'artifactId and version survive the envelope')

    const surfaced = parentToolResults(requests).find(text => text.includes('"carousel"')) ?? ''
    const parsed = JSON.parse(surfaced)
    assert.deepEqual(parsed.carousel, CAROUSEL, 'the parent receives the carousel payload verbatim')
    assert.equal(parsed.carousel.artifactId, CAROUSEL.artifactId)
    assert.equal(parsed.carousel.version, CAROUSEL.version)
    assert.ok(Array.isArray(parsed.carousel.slides), 'slides array preserved')
  })

  it('states the result contract every delegate must follow', async () => {
    const { delegationResultContract } = await import('../server/flue/delegation.ts')
    const contract = delegationResultContract('{"nextStep": string}')
    assert.match(contract, /strict JSON with no prose and no code fences: \{"nextStep": string\}\./)
    assert.match(contract, /"truncated": true only when a tool answered SUBAGENT_TURN_BUDGET/)
    assert.match(contract, /"passthrough": "carousel"/)
  })
})