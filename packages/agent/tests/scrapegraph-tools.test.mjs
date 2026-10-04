import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

// ScrapeGraphAI integration: default scraper for scrape_url + dedicated tools.
const OWNER = 'scrape-owner'
const BUSINESS = 'scrape-business'

let cleanup
let createAgentTools
let createAgentToolContext
let tools

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
    const payload = await runTool(findTool('scrape_url'), { url: 'https://example.com' })
    assert.equal(payload.scraper, 'scrapegraphai')
    assert.match(payload.content, /ScrapeGraphAI/)
    assert.equal(payload.untrusted, true)
  })

  it('exposes scrape, extract, search, and credits tools', async () => {
    const scrape = await runTool(findTool('scrapegraph_scrape'), { url: 'https://example.com' })
    assert.equal(scrape.scraper, 'scrapegraphai')

    const extract = await runTool(findTool('scrapegraph_extract'), { url: 'https://example.com', prompt: 'title' })
    assert.equal(extract.json.title, 'Extracted')

    const search = await runTool(findTool('scrapegraph_search'), { query: 'ai news' })
    assert.equal(search.results.length, 1)

    const credits = await runTool(findTool('scrapegraph_credits'))
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
      const scrapeUrl = failingTools.find(tool => tool.name === 'scrape_url')
      const payload = await runTool(scrapeUrl, { url: `http://127.0.0.1:${address.port}/page` })
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
      const searchTool = keyless.find(tool => tool.name === 'scrapegraph_search')
      await assert.rejects(runTool(searchTool, { query: 'x' }), /SCRAPEGRAPH_NOT_CONFIGURED/)
    }
    finally {
      if (previousKey) process.env.SGAI_API_KEY = previousKey
    }
  })
})
