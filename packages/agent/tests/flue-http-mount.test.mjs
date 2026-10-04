import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createApp, getHeader, toNodeListener, use } from 'h3'
import { createFlueAgentHandler } from '../server/flue/http.ts'
import { stopFlueRuntime } from '../server/flue/runtime.ts'

/**
 * T25 STOP-GATE spike (PRD-FLUE-RUNTIME-CONVERGENCE §6.2):
 * - `createAgentRouter()` is served through the Nitro/h3 bridge with no second
 *   server and no sidecar.
 * - A `POST` admits a message (202 + submission coordinates), `GET ?view=history`
 *   materializes the reply, `GET ?view=updates` streams `text/event-stream`
 *   through h3 untouched, and `POST /:id/abort` is routed.
 * - Conversation ids are namespaced per caller: one namespace never reads
 *   another namespace's conversation.
 */

const MODEL_ID = 'stub-model'
const FINAL_TEXT = 'Mounted Flue agent replied.'
const MOUNT = '/api/v1/agent/flue'

function sseChunk(delta, finishReason = null) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

function startStubProvider() {
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push(JSON.parse(body))
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    for (const word of FINAL_TEXT.split(' ')) {
      res.write(`data: ${JSON.stringify(sseChunk({ role: 'assistant', content: `${word} ` }))}\n\n`)
    }
    res.write(`data: ${JSON.stringify({ ...sseChunk({}, 'stop'), usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 } })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  })
  return { server, requests }
}

function closeServer(server) {
  return new Promise((resolve) => { server.close(() => resolve()) })
}

async function startStubProviderObject() {
  const { createProvider } = await import('@earendil-works/pi-ai')
  const { stream, streamSimple } = await import('@earendil-works/pi-ai/api/openai-completions')
  const stub = startStubProvider()
  await new Promise((resolve) => { stub.server.listen(0, '127.0.0.1', resolve) })
  const baseUrl = `http://127.0.0.1:${stub.server.address().port}/v1`
  const provider = createProvider({
    id: 'stub',
    name: 'Stub Provider',
    baseUrl,
    auth: {
      apiKey: {
        name: 'Stub key',
        resolve: () => Promise.resolve({ auth: { apiKey: 'stub-key' }, source: 'stub' }),
      },
    },
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
  return { stub, provider }
}

async function startStubAgentServer() {
  const { stub, provider } = await startStubProviderObject()
  const { defineTool, useModel, useTool } = await import('@flue/runtime')
  function MountSpikeAgent() {
    useModel('stub/stub-model')
    useTool(defineTool({
      name: 'noop',
      description: 'No operation.',
      run: async () => ({ output: 'ok' }),
    }))
    return 'Answer briefly.'
  }
  const handler = createFlueAgentHandler({
    agent: MountSpikeAgent,
    basePath: MOUNT,
    providers: [provider],
    resolveNamespace: event => getHeader(event, 'x-stub-namespace') ?? 'user-a',
  })
  const app = createApp()
  use(app, handler)
  const server = createServer(toNodeListener(app))
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  return { stub, server, base: `http://127.0.0.1:${server.address().port}` }
}

async function waitForReply(url, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const response = await fetch(url)
    const body = await response.text()
    if (body.includes(FINAL_TEXT)) return body
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`conversation history never contained "${FINAL_TEXT}"`)
}

function admit(base, id, headers = {}) {
  return fetch(`${base}${MOUNT}/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ kind: 'user', body: 'Say hello.' }),
  })
}

afterEach(async () => {
  await stopFlueRuntime()
})

describe('Flue conversation routes mounted in Nitro (T25 stop-gate)', () => {
  it('admits a message, materializes history, streams updates, and aborts', async () => {
    const { stub, server, base } = await startStubAgentServer()
    try {
      const admission = await admit(base, 'conv-1')
      assert.equal(admission.status, 202, 'message admission is a 202')
      const receipt = await admission.json()
      assert.match(receipt.submissionId, /^sub_/, 'admission carries a submission id')
      assert.equal(typeof receipt.offset, 'string', 'admission carries a resume offset')

      const history = await waitForReply(`${base}${MOUNT}/conv-1?view=history`)
      assert.ok(history.includes(FINAL_TEXT), 'history materializes the agent reply')
      assert.equal(stub.requests.length, 1, 'the stub provider served one model turn')

      const updates = await fetch(`${base}${MOUNT}/conv-1?view=updates&offset=-1&live=sse`)
      assert.equal(updates.status, 200, 'updates view is served')
      assert.match(updates.headers.get('content-type') ?? '', /^text\/event-stream/)
      const reader = updates.body.getReader()
      const first = await Promise.race([
        reader.read(),
        new Promise(resolve => setTimeout(() => resolve(null), 5000)),
      ])
      await reader.cancel()
      assert.ok(first?.value, 'the updates stream emitted a chunk through h3')
      assert.match(new TextDecoder().decode(first.value), /data:/, 'the chunk uses SSE framing')

      const abort = await fetch(`${base}${MOUNT}/conv-1/abort`, { method: 'POST' })
      assert.ok(abort.status < 400, 'abort is routed to the conversation')
    } finally {
      await closeServer(server)
      await closeServer(stub.server)
    }
  })

  it('namespaces conversation ids per caller and refuses paths outside the mount', async () => {
    const { stub, server, base } = await startStubAgentServer()
    try {
      const admitted = await admit(base, 'shared-id')
      assert.equal(admitted.status, 202)
      await waitForReply(`${base}${MOUNT}/shared-id?view=history`)

      const otherNamespace = await fetch(`${base}${MOUNT}/shared-id?view=history`, {
        headers: { 'x-stub-namespace': 'user-b' },
      })
      const otherBody = await otherNamespace.text()
      assert.ok(!otherBody.includes(FINAL_TEXT), 'another namespace never reads that conversation')

      const outside = await fetch(`${base}/api/v1/agent/other`)
      assert.equal(outside.status, 404, 'requests outside the mount are rejected')
    } finally {
      await closeServer(server)
      await closeServer(stub.server)
    }
  })
})
