import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// ScrapeGraphAI integration: default scraper for scrape_url + dedicated tools.
const OWNER = 'scrape-owner'
const BUSINESS = 'scrape-business'

let cleanup
let createAgentTools
let createAgentToolContext
let tools

function parseResult(result) {
  return JSON.parse(result.content[0].text)
}

function findTool(name) {
  const tool = tools.find(entry => entry.name === name)
  assert.ok(tool, `tool ${name} exists`)
  return tool
}

const fakeClient = {
  scrape: async ({ url }) => ({
    status: 'success',
    data: { results: { markdown: { data: [`# Page from ScrapeGraphAI for ${url}`] } } },
    elapsedMs: 12,
  }),
  extract: async ({ url, prompt }) => ({
    status: 'success',
    data: { json: { url, prompt, title: 'Extracted' } },
    elapsedMs: 20,
  }),
  search: async ({ query }) => ({
    status: 'success',
    data: { results: [{ title: `Result for ${query}`, url: 'https://example.com' }] },
    elapsedMs: 15,
  }),
  credits: async () => ({
    status: 'success',
    data: { remaining: 1000, used: 5, plan: 'pro' },
    elapsedMs: 5,
  }),
}

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'scrape@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Scrape Co' })
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  tools = createAgentTools(createAgentToolContext({
    userId: OWNER,
    businessId: BUSINESS,
    scrapegraph: fakeClient,
    validateUrl: async url => url,
  }))
})

after(() => cleanup())

describe('scrapegraph tools', () => {
  it('scrape_url uses ScrapeGraphAI as the default scraper', async () => {
    const result = await findTool('scrape_url').execute('call-1', { url: 'https://example.com' }, undefined, undefined, undefined)
    const payload = parseResult(result)
    assert.equal(payload.scraper, 'scrapegraphai')
    assert.match(payload.content, /ScrapeGraphAI/)
    assert.equal(payload.untrusted, true)
  })

  it('exposes scrape, extract, search, and credits tools', async () => {
    const scrape = parseResult(await findTool('scrapegraph_scrape').execute('call-2', { url: 'https://example.com' }, undefined, undefined, undefined))
    assert.equal(scrape.scraper, 'scrapegraphai')

    const extract = parseResult(await findTool('scrapegraph_extract').execute('call-3', { url: 'https://example.com', prompt: 'title' }, undefined, undefined, undefined))
    assert.equal(extract.json.title, 'Extracted')

    const search = parseResult(await findTool('scrapegraph_search').execute('call-4', { query: 'ai news' }, undefined, undefined, undefined))
    assert.equal(search.results.length, 1)

    const credits = parseResult(await findTool('scrapegraph_credits').execute('call-5', {}, undefined, undefined, undefined))
    assert.equal(credits.credits.remaining, 1000)
  })

  it('falls back to raw fetch with a warning when ScrapeGraphAI fails', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>Raw page</h1><script>ignored()</script></body></html>')
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()

    const failingTools = createAgentTools(createAgentToolContext({
      userId: OWNER,
      businessId: BUSINESS,
      validateUrl: async url => url,
      scrapegraph: { ...fakeClient, scrape: async () => ({ status: 'error', data: null, error: 'quota exceeded', elapsedMs: 3 }) },
    }))

    try {
      const result = await failingTools.find(tool => tool.name === 'scrape_url')
        .execute('call-6', { url: `http://127.0.0.1:${address.port}/page` }, undefined, undefined, undefined)
      const payload = parseResult(result)
      assert.equal(payload.scraper, 'fetch')
      assert.match(payload.warning, /quota exceeded/)
      assert.match(payload.content, /Raw page/)
    }
    finally {
      server.close()
    }
  })

  it('returns a typed error when no ScrapeGraphAI key is configured', async () => {
    const previousKey = process.env.SGAI_API_KEY
    delete process.env.SGAI_API_KEY
    const keyless = createAgentTools(createAgentToolContext({
      userId: 'nobody',
      businessId: BUSINESS,
      validateUrl: async url => url,
    }))
    try {
      await assert.rejects(
        keyless.find(tool => tool.name === 'scrapegraph_search').execute('call-7', { query: 'x' }, undefined, undefined, undefined),
        /SCRAPEGRAPH_NOT_CONFIGURED/,
      )
    }
    finally {
      if (previousKey) process.env.SGAI_API_KEY = previousKey
    }
  })
})
