import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

// User-configured Python tools backend: proxy tools + typed failures.
const OWNER = 'python-owner'
const BUSINESS = 'python-business'

let cleanup
let createAgentTools
let createAgentToolContext
let toolBackendsService
let tools
let server
let baseUrl

function findTool(name) {
  const tool = tools.find(entry => entry.name === name)
  assert.ok(tool, `tool ${name} exists`)
  return tool
}

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'python@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Python Co' })
  ;({ toolBackendsService } = await import('#layers/BaseDB/server/services/tool-backends.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))

  server = createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      if (req.url === '/health') return res.end(JSON.stringify({ status: 'ok' }))
      if (req.url === '/tools') {
        return res.end(JSON.stringify({ tools: [{ name: 'fetch_text', description: 'Fetch text' }] }))
      }
      if (req.url?.startsWith('/tools/') && req.url.endsWith('/run')) {
        const name = decodeURIComponent(req.url.split('/')[2])
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        return res.end(JSON.stringify({ tool: name, result: { echo: body.args } }))
      }
      res.statusCode = 404
      res.end(JSON.stringify({ detail: 'not found' }))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`

  const saved = await toolBackendsService.save(OWNER, { pythonBackendUrl: baseUrl, pythonBackendToken: 'test-token' })
  assert.equal(saved.success, true)
  tools = createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS }))
})

after(async () => {
  await new Promise(resolve => server.close(resolve))
  await cleanup()
})

describe('python tools proxy', () => {
  it('lists tools from the configured backend', async () => {
    const payload = await runTool(findTool('python_tools_list'))
    assert.equal(payload.tools[0].name, 'fetch_text')
  })

  it('runs a backend tool with arguments', async () => {
    const payload = await runTool(findTool('python_tool_run'), {
      tool: 'fetch_text',
      args: { url: 'https://example.com' },
    })
    assert.equal(payload.tool, 'fetch_text')
    assert.equal(payload.result.echo.url, 'https://example.com')
  })

  it('fails typed when the backend is unreachable', async () => {
    const unreachable = createAgentTools(createAgentToolContext({ userId: 'unreachable-user', businessId: BUSINESS }))
    const saved = await toolBackendsService.save('unreachable-user', { pythonBackendUrl: 'http://127.0.0.1:9' })
    assert.equal(saved.success, true)
    const listTool = unreachable.find(tool => tool.name === 'python_tools_list')
    await assert.rejects(runTool(listTool), /PYTHON_BACKEND_UNREACHABLE/)
  })

  it('fails typed when no backend is configured', async () => {
    const unconfigured = createAgentTools(createAgentToolContext({ userId: 'nobody', businessId: BUSINESS }))
    const runToolRef = unconfigured.find(tool => tool.name === 'python_tool_run')
    await assert.rejects(runTool(runToolRef, { tool: 'fetch_text' }), /PYTHON_BACKEND_NOT_CONFIGURED/)
  })
})
