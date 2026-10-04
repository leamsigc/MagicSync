import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'

// End goal: the card research pipeline runs the research-agent specialist
// (LangSearch skill + web_search tool) and falls back to the service path
// when the agent output cannot be validated. No real network.
const OWNER = 'research-owner'
const BUSINESS = 'research-business'

const FALLBACK_BRIEF = JSON.stringify({
  brief: 'Fallback brief about onboarding.',
  citations: [{ label: 'Evidence B', url: 'https://evidence.example/b' }],
})

let db
let schema
let cleanup
let agentWorkflowService
let agentStub
let fallbackStub
let langsearchStub
let server

function jsonResponse(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function startLangSearchStub() {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const query = JSON.parse(body || '{}').query ?? ''
      jsonResponse(res, 200, {
        log_id: 'log-research',
        data: {
          webPages: {
            value: [{
              name: `Evidence for ${query}`,
              url: 'https://evidence.example/a',
              text: 'Onboarding teams lose time on manual setup.',
              datePublished: '2026-01-05',
            }],
          },
        },
      })
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}/v1/web-search`
}

function fakeComplete() {
  return Promise.resolve(FALLBACK_BRIEF)
}

/**
 * T29: the agent run resolves its provider from `apiBaseUrl` (the Flue path),
 * so the fixture points the run at the same stub the assertions read.
 */
function runConfig(stub) {
  return {
    runtime: null,
    model: null,
    provider: 'stub',
    modelId: 'stub-model',
    apiKey: 'stub-key',
    apiBaseUrl: stub.url,
    systemContext: '',
    complete: fakeComplete,
  }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'research@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Research Co' })

  process.env.LANGSEARCH_API_KEY = 'test-langsearch-key'
  process.env.LANGSEARCH_API_URL = await startLangSearchStub()

  ;({ agentWorkflowService } = await import('../server/services/agent-workflow.service.ts'))

  agentStub = await startStubProvider({
    toolScript: [{ name: 'web_search', args: { query: 'onboarding tools' } }],
    finalText: JSON.stringify({
      brief: 'Agent brief about onboarding.',
      citations: [{ label: 'Evidence A', url: 'https://evidence.example/a' }],
      keyFacts: ['Manual setup wastes time'],
    }),
  })
  fallbackStub = await startStubProvider({ toolScript: [], finalText: 'not valid json at all' })

})

after(async () => {
  await agentStub.close()
  await fallbackStub.close()
  server.close()
  delete process.env.LANGSEARCH_API_KEY
  delete process.env.LANGSEARCH_API_URL
  await cleanup()
})

describe('runResearchTask (agent-first)', () => {
  it('runs the research-agent specialist with only its tools and returns validated JSON', async () => {
    const result = await agentWorkflowService.runResearchTask({
      userId: OWNER,
      businessId: BUSINESS,
      topic: 'onboarding',
      run: runConfig(agentStub),
    })
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.usedAgent, true)
    assert.match(result.data.brief, /Agent brief about onboarding/)
    assert.match(result.data.brief, /https:\/\/evidence\.example\/a/)
    assert.equal(result.data.citations.length, 1)
    assert.ok(result.data.agentRunId)

    const toolNames = agentStub.requests[0].tools.map(tool => tool.function.name).sort()
    // T28: the research-agent profile allowlist is its mount (budget-sized).
    // T29: Flue always adds its built-in delegation tool `task`.
    assert.deepEqual(toolNames, ['retrieve', 'scrape_url', 'task', 'web_search'])

    const [runRow] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, result.data.agentRunId))
    assert.equal(runRow.status, 'completed')
    assert.equal(runRow.agentName, 'research-agent')

    const sessions = await db.select().from(schema.agentChatSessions)
    assert.ok(sessions.some(row => row.threadId.startsWith('task:')), 'headless session persisted for oversight')
    const threads = await db.select().from(schema.chatThreads)
    assert.equal(threads.length, 0, 'headless runs never create chat threads')
  })

  it('falls back to the service path when agent output is unparsable', async () => {
    const result = await agentWorkflowService.runResearchTask({
      userId: OWNER,
      businessId: BUSINESS,
      topic: 'onboarding fallback',
      run: runConfig(fallbackStub),
    })
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.usedAgent, false)
    assert.match(result.data.brief, /Fallback brief about onboarding/)
    assert.match(result.data.brief, /https:\/\/evidence\.example\/a/, 'LangSearch evidence URL survives synthesis')
    assert.equal(result.data.sourcesUsed, 1)
  })
})
