import { createServer } from 'node:http'

const MODEL_ID = 'stub-model'

function sseChunk(delta, finishReason = null) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function finishSse(res) {
  res.write('data: [DONE]\n\n')
  res.end()
}

function writeToolCallTurn(res, toolName, toolArgs) {
  writeSse(res, sseChunk({
    role: 'assistant',
    content: null,
    tool_calls: [{
      index: 0,
      id: 'call_stub_1',
      type: 'function',
      function: { name: toolName, arguments: JSON.stringify(toolArgs) },
    }],
  }))
  writeSse(res, {
    ...sseChunk({}, 'tool_calls'),
    usage: { prompt_tokens: 21, completion_tokens: 7, total_tokens: 28 },
  })
  finishSse(res)
}

function writeTextTurn(res, text) {
  for (const word of text.split(' ')) {
    writeSse(res, sseChunk({ role: 'assistant', content: `${word} ` }))
  }
  writeSse(res, {
    ...sseChunk({}, 'stop'),
    usage: { prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 },
  })
  finishSse(res)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      }
      catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function isChatCompletionsRequest(req) {
  return req.method === 'POST' && (req.url ?? '').endsWith('/chat/completions')
}

function countToolResults(payload) {
  return payload.messages.filter(message => message.role === 'tool').length
}

/**
 * Minimal OpenAI-compatible /chat/completions stub.
 * Walks a scripted list of tool calls (one per turn) and then streams text.
 * With no script it answers one tool call followed by text. No network.
 * With errorMode set, every request fails like the real provider would.
 * `authorizations` records the `Authorization` header (or null when keyless)
 * of every chat-completions request, so per-run credential isolation is
 * observable on the wire (T26).
 */
export async function startStubProvider(options = {}) {
  const script = options.toolScript ?? [{
    name: options.toolName ?? 'echo_note',
    args: options.toolArgs ?? { note: 'hello from stub' },
  }]
  const finalText = options.finalText ?? 'Stub finished the task.'
  const errorMode = options.errorMode ?? null
  const requests = []
  const authorizations = []

  const server = createServer(async (req, res) => {
    if (!isChatCompletionsRequest(req)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
      return
    }
    const payload = await readJsonBody(req)
    requests.push(payload)
    authorizations.push(req.headers.authorization ?? null)
    if (errorMode) {
      res.writeHead(errorMode.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: errorMode.message, type: 'invalid_request_error', code: errorMode.code } }))
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const step = countToolResults(payload)
    if (step < script.length) {
      writeToolCallTurn(res, script[step].name, script[step].args)
      return
    }
    writeTextTurn(res, finalText)
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    requests,
    authorizations,
    finalText,
    close: () => new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()))
    }),
  }
}
