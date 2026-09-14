import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'
import { writeStubModelsConfig } from './stub-models.mjs'
import { applyRunApiKey, createAgentModelRuntime } from '../server/utils/pi-runtime.ts'

// End goal: the card research pipeline runs the researcher agent (LangSearch
// skill + web_search tool) and falls back to the service path when the agent
// output cannot be validated. No real network.
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
let runtime
let fallbackRuntime
let agentStub
let fallbackStub
let langsearchStub
const dirs = []
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

function runConfig(stubRuntime) {
  return {
    runtime: stubRuntime,
    model: stubRuntime.getModel('stub', 'stub-model'),
    provider: 'stub',
    modelId: 'stub-model',
    apiKey: null,
    apiBaseUrl: null,
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

  const dir = mkdtempSync(join(tmpdir(), 'agent-research-'))
  dirs.push(dir)
  const modelsPath = writeStubModelsConfig(dir, agentStub.url)
  runtime = await createAgentModelRuntime({ modelsPath })
  await applyRunApiKey(runtime, 'stub', 'stub-key')

  const fallbackDir = mkdtempSync(join(tmpdir(), 'agent-research-fallback-'))
  dirs.push(fallbackDir)
  const fallbackModels = writeStubModelsConfig(fallbackDir, fallbackStub.url)
  fallbackRuntime = await createAgentModelRuntime({ modelsPath: fallbackModels })
  await applyRunApiKey(fallbackRuntime, 'stub', 'stub-key')
})

after(async () => {
  await agentStub.close()
  await fallbackStub.close()
  server.close()
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  delete process.env.LANGSEARCH_API_KEY
  delete process.env.LANGSEARCH_API_URL
  await cleanup()
})

describe('runResearchTask (agent-first)', () => {
  it('runs the researcher agent with only its tools and returns validated JSON', async () => {
    const result = await agentWorkflowService.runResearchTask({
      userId: OWNER,
      businessId: BUSINESS,
      topic: 'onboarding',
      run: runConfig(runtime),
    })
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.usedAgent, true)
    assert.match(result.data.brief, /Agent brief about onboarding/)
    assert.match(result.data.brief, /https:\/\/evidence\.example\/a/)
    assert.equal(result.data.citations.length, 1)
    assert.ok(result.data.agentRunId)

    const toolNames = agentStub.requests[0].tools.map(tool => tool.function.name).sort()
    assert.deepEqual(toolNames, ['research_topic', 'retrieve', 'scrape_url', 'web_search'])

    const [runRow] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, result.data.agentRunId))
    assert.equal(runRow.status, 'completed')
    assert.equal(runRow.agentName, 'researcher')

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
      run: runConfig(fallbackRuntime),
    })
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.usedAgent, false)
    assert.match(result.data.brief, /Fallback brief about onboarding/)
    assert.match(result.data.brief, /https:\/\/evidence\.example\/a/, 'LangSearch evidence URL survives synthesis')
    assert.equal(result.data.sourcesUsed, 1)
  })
})
