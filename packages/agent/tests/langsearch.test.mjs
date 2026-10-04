import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

// LangSearch: live web search client + web_search tool. Network is stubbed
// through LANGSEARCH_API_URL (resolved at import time, so it is set in before).
const OWNER = 'langsearch-owner'
const BUSINESS = 'langsearch-business'

let cleanup
let searchLangSearch
let resolveLangSearchKey
let createAgentTools
let createAgentToolContext
let toolBackendsService
let server
let handleRequest = (_req, res) => jsonResponse(res, 500, { error: 'no handler' })
let apiCalls = 0

function jsonResponse(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'langsearch@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Lang Co' })
  server = createServer((req, res) => {
    apiCalls += 1
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => handleRequest(req, res, body))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  process.env.LANGSEARCH_API_URL = `http://127.0.0.1:${server.address().port}/v1/web-search`
  ;({ searchLangSearch, resolveLangSearchKey } = await import('../server/utils/langsearch.ts'))
  assert.ok((await import('../server/utils/langsearch.ts')).LANGSEARCH_ENDPOINT.startsWith('http://127.0.0.1'), 'test endpoint seam active')
  ;({ toolBackendsService } = await import('#layers/BaseDB/server/services/tool-backends.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
})

after(async () => {
  server.close()
  delete process.env.LANGSEARCH_API_URL
  await cleanup()
})

describe('langsearch client', () => {
  it('normalizes results and passes query options through', async () => {
    handleRequest = (_req, res, body) => {
      const payload = JSON.parse(body)
      assert.equal(payload.query, 'ai agents')
      assert.equal(payload.count, 3)
      assert.deepEqual(payload.contents, { text: true })
      jsonResponse(res, 200, {
        log_id: 'log-1',
        usage: { input_tokens: 12, output_tokens: 34 },
        data: {
          webPages: {
            value: [
              { name: 'Result A', url: 'https://a.example', text: 'Full text A', datePublished: '2026-01-02' },
              { name: 'Result B', url: 'https://b.example', snippet: 'Snippet B' },
            ],
          },
        },
      })
    }
    const result = await searchLangSearch({ query: 'ai agents', count: 3, fullText: true }, 'test-key')
    assert.equal(result.success, true)
    assert.equal(result.data.logId, 'log-1')
    assert.equal(result.data.usage.inputTokens, 12)
    assert.deepEqual(result.data.results, [
      { title: 'Result A', url: 'https://a.example', text: 'Full text A', datePublished: '2026-01-02' },
      { title: 'Result B', url: 'https://b.example', text: 'Snippet B', datePublished: null },
    ])
  })

  it('maps auth failures without retrying', async () => {
    apiCalls = 0
    handleRequest = (_req, res) => jsonResponse(res, 401, { error: 'nope' })
    const result = await searchLangSearch({ query: 'x' }, 'bad-key')
    assert.equal(result.success, false)
    assert.equal(result.code, 'LANGSEARCH_AUTH_FAILED')
    assert.equal(apiCalls, 1)
  })

  it('maps bad requests', async () => {
    handleRequest = (_req, res) => jsonResponse(res, 400, { error: 'bad' })
    const result = await searchLangSearch({ query: 'x' }, 'key')
    assert.equal(result.success, false)
    assert.equal(result.code, 'LANGSEARCH_BAD_REQUEST')
  })

  it('retries server errors then reports failure', async () => {
    apiCalls = 0
    handleRequest = (_req, res) => jsonResponse(res, 500, { error: 'boom' })
    const result = await searchLangSearch({ query: 'x' }, 'key')
    assert.equal(result.success, false)
    assert.equal(result.code, 'LANGSEARCH_FAILED')
    assert.equal(apiCalls, 3, 'bounded retries (3 attempts total)')
  })
})

describe('langsearch key resolution', () => {
  it('prefers the per-user key over the env fallback', async () => {
    process.env.LANGSEARCH_API_KEY = 'env-key'
    await toolBackendsService.save(OWNER, { langsearchApiKey: 'user-key' })
    const result = await resolveLangSearchKey(OWNER)
    assert.equal(result.success, true)
    assert.equal(result.data, 'user-key')
  })

  it('falls back to the env key and then null', async () => {
    process.env.LANGSEARCH_API_KEY = 'env-key'
    const fromEnv = await resolveLangSearchKey('no-settings-user')
    assert.equal(fromEnv.data, 'env-key')
    delete process.env.LANGSEARCH_API_KEY
    const missing = await resolveLangSearchKey('no-settings-user')
    assert.equal(missing.data, null)
  })
})

describe('web_search tool', () => {
  const fakeClient = async (input) => ({
    success: true,
    data: {
      results: [{ title: `Result for ${input.query}`, url: 'https://example.com', text: 'Evidence', datePublished: null }],
      logId: 'log-9',
      usage: null,
    },
  })

  function toolContext(overrides = {}) {
    return createAgentToolContext({
      userId: OWNER,
      businessId: BUSINESS,
      langsearchKey: 'test-key',
      langsearch: fakeClient,
      ...overrides,
    })
  }

  function findTool(context) {
    const tools = createAgentTools(context)
    const tool = tools.find(entry => entry.name === 'web_search')
    assert.ok(tool, 'web_search tool exists')
    return tool
  }

  it('returns normalized results with untrusted framing', async () => {
    const payload = await runTool(findTool(toolContext()), { query: 'onboarding' })
    assert.equal(payload.untrusted, true)
    assert.equal(payload.scraper, 'langsearch')
    assert.equal(payload.results[0].url, 'https://example.com')
    assert.equal(payload.logId, 'log-9')
  })

  it('fails with a typed error when no key is configured', async () => {
    const tool = findTool(toolContext({ langsearchKey: null }))
    await assert.rejects(
      () => runTool(tool, { query: 'onboarding' }),
      /LANGSEARCH_NOT_CONFIGURED/,
    )
  })
})
