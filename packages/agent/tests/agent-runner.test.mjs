import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'

/**
 * T29 — the runner on Flue. The contract under test is the one the chat UI
 * depends on (PRD §3.2): the event names, their order, the `runId:seq` stable
 * ids, the chat rows, and the `agent_runs` telemetry. The run loop, the tool
 * loop and streaming are Flue's now; this file asserts only the adapter.
 *
 * The provider seam is the stub's base URL (`apiBaseUrl`) instead of the pi
 * `modelRuntime` the test used to inject.
 */
const OWNER = 'runner-owner'
const BUSINESS = 'runner-business'

const echoNote = defineTool({
  name: 'echo_note',
  description: 'Echo a note back to the model.',
  input: v.object({ note: v.pipe(v.string(), v.description('Note to echo')) }),
  run: async toolCtx => ({ output: `note: ${toolCtx.data.note}` }),
})

const slowNote = defineTool({
  name: 'slow_note',
  description: 'Wait before returning a note.',
  input: v.object({ note: v.pipe(v.string(), v.description('Note to echo')) }),
  run: async toolCtx => {
    await new Promise(resolve => setTimeout(resolve, 400))
    return { output: `note: ${toolCtx.data.note}` }
  },
})

let db
let schema
let cleanup
let chatService
let agentSessionService
let agentRunnerService
let stub

/** Every run in this file rides the stub provider. */
function stubRun(overrides = {}) {
  return {
    provider: 'stub',
    model: 'stub-model',
    apiKey: 'stub-key',
    apiBaseUrl: stub.url,
    ...overrides,
  }
}

async function runChat(text, overrides = {}, onEvent) {
  const thread = await chatService.createThread(OWNER, { title: text.slice(0, 40) })
  const events = []
  const result = await agentRunnerService.run({
    userId: OWNER,
    businessId: BUSINESS,
    threadId: thread.data.id,
    text,
    ...stubRun({ customTools: [echoNote], ...overrides }),
  }, (event) => { events.push(event); onEvent?.(event) })
  return { result, events, threadId: thread.data.id }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'runner@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Runner Co' })
  ;({ chatService } = await import('#layers/BaseDB/server/services/chat.service.ts'))
  ;({ agentSessionService } = await import('../server/services/agent-session.service.ts'))
  ;({ agentRunnerService } = await import('../server/services/agent-runner.service.ts'))
  stub = await startStubProvider({ toolName: 'echo_note', toolArgs: { note: 'hello from stub' }, finalText: 'Runner done.' })
})

after(async () => {
  await stub.close()
  await cleanup()
})

describe('agent runner on Flue (T29)', () => {
  it('streams contract events and persists session, chat, and run rows', async () => {
    const { result, events, threadId } = await runChat('Run the echo tool.')

    assert.equal(result.success, true, result.error ?? '')
    const types = events.map(event => event.type)
    assert.ok(types.includes('message.started'))
    assert.ok(types.indexOf('message.started') < types.indexOf('tool.started'))
    assert.ok(types.indexOf('tool.started') < types.indexOf('tool.finished'))
    assert.ok(types.indexOf('tool.finished') < types.indexOf('text.delta'))
    assert.equal(types.at(-2), 'message.completed')
    assert.equal(types.at(-1), 'run.completed')
    assert.ok(events.every(event => String(event.id).startsWith(`${result.data.runId}:`)), 'stable event ids')
    assert.ok(events.filter(event => event.type === 'message.started').length === 1, 'message.started stays once per run')
    assert.ok(result.data.tokensUsed > 0, 'model usage is read from the Flue turn events')

    const session = await agentSessionService.getSession(OWNER, result.data.sessionId)
    assert.equal(session.success, true, 'the session row is the stable conversation handle')
    assert.ok(session.data.piSessionId.startsWith('chat-'), 'the session row carries the Flue conversation id')

    const messages = await chatService.getMessages(threadId, OWNER)
    assert.equal(messages.data.length, 2)
    assert.equal(messages.data[1].content, 'Runner done.')

    const [runRow] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, result.data.runId))
    assert.equal(runRow.status, 'completed')
    assert.ok(JSON.parse(runRow.toolEvents).length >= 2)
  })

  it('cancels an active run and persists the cancelled status', async () => {
    const thread = await chatService.createThread(OWNER, { title: 'Cancel run' })
    const events = []
    let runId
    let cancelResult
    const resultPromise = agentRunnerService.run({
      userId: OWNER,
      businessId: BUSINESS,
      threadId: thread.data.id,
      text: 'Run the slow tool.',
      ...stubRun({ customTools: [slowNote] }),
    }, (event) => {
      events.push(event)
      if (event.type === 'tool.started' && !cancelResult) {
        runId = event.id.split(':')[0]
        cancelResult = agentRunnerService.cancel(OWNER, runId)
      }
    })
    const result = await resultPromise
    assert.equal((await cancelResult).success, true)
    assert.equal(result.success, false)
    assert.equal(result.code, 'AGENT_CANCELLED')
    assert.equal(result.data, undefined)
    assert.ok(events.some(event => event.type === 'run.cancelled'))
    assert.ok(!events.some(event => event.type === 'run.completed'))

    const [runRow] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId))
    assert.equal(runRow.status, 'cancelled')
  })

  it('continues a stored session without replaying the earlier turns', async () => {
    const first = await runChat('First turn.')
    assert.equal(first.result.success, true, first.result.error ?? '')

    const secondEvents = []
    const second = await runChat('Second turn.', { sessionId: first.result.data.sessionId }, event => secondEvents.push(event))
    assert.equal(second.result.success, true, second.result.error ?? '')
    assert.equal(second.result.data.sessionId, first.result.data.sessionId)
    assert.ok(secondEvents.length > 0, 'the follow-up run streams its own events')

    // A Flue read replays the conversation from its beginning; the runner must
    // project only this submission, or the chat would double every delta.
    assert.equal(secondEvents.filter(event => event.type === 'message.started').length, 1)
    assert.equal(secondEvents.filter(event => event.type === 'tool.started').length, 0, 'no tool call from the earlier turn is re-emitted')
    assert.equal(secondEvents.filter(event => event.type === 'text.delta').length > 0, true, 'the new turn still streams')
  })

  it('fails with a typed code when no model is configured', async () => {
    const previousProvider = process.env.AGENT_DEFAULT_PROVIDER
    const previousModel = process.env.AGENT_DEFAULT_MODEL
    delete process.env.AGENT_DEFAULT_PROVIDER
    delete process.env.AGENT_DEFAULT_MODEL
    const thread = await chatService.createThread(OWNER, { title: 'No model' })
    const events = []
    const result = await agentRunnerService.run({
      userId: OWNER,
      businessId: BUSINESS,
      threadId: thread.data.id,
      text: 'Hello',
    }, event => { events.push(event) })
    if (previousProvider) process.env.AGENT_DEFAULT_PROVIDER = previousProvider
    if (previousModel) process.env.AGENT_DEFAULT_MODEL = previousModel

    assert.equal(result.success, false)
    assert.equal(result.code, 'MODEL_NOT_CONFIGURED')
    assert.equal(events.at(-1)?.type, 'error')
    assert.equal(events.at(-1)?.code, 'MODEL_NOT_CONFIGURED')
  })

  it('surfaces the real provider error instead of an empty response', async () => {
    const failing = await startStubProvider({
      errorMode: { status: 401, message: 'Invalid API key provided', code: 'invalid_api_key' },
    })
    try {
      const thread = await chatService.createThread(OWNER, { title: 'Provider failure' })
      const events = []
      const result = await agentRunnerService.run({
        userId: OWNER,
        businessId: BUSINESS,
        threadId: thread.data.id,
        text: 'Hello',
        provider: 'stub',
        model: 'stub-model',
        apiKey: 'bad-key',
        apiBaseUrl: failing.url,
      }, (event) => { events.push(event) })

      assert.equal(result.success, false)
      assert.match(result.error ?? '', /Invalid API key provided/, 'real provider message surfaces')
      assert.equal(result.code, 'PROVIDER_AUTH_FAILED')
      const errorEvent = events.find(event => event.type === 'error')
      assert.ok(errorEvent, 'error event streamed')
      assert.equal(errorEvent.code, 'PROVIDER_AUTH_FAILED')
      assert.match(errorEvent.message ?? '', /Invalid API key provided/)
      assert.ok(!events.some(event => event.type === 'message.completed'), 'no false completion event')
    }
    finally {
      await failing.close()
    }
  })

  it('unwraps nested JSON error envelopes to the human-readable message', async () => {
    const innerMessage = 'You exceeded your current quota, please check your plan and billing details.'
    // Gemini-style envelope: the provider body is itself JSON inside the
    // harness error's message field.
    const providerBody = JSON.stringify({ error: { code: 429, message: innerMessage, status: 'RESOURCE_EXHAUSTED' } })
    const failing = await startStubProvider({
      errorMode: { status: 429, message: providerBody, code: 'RESOURCE_EXHAUSTED' },
    })
    try {
      const thread = await chatService.createThread(OWNER, { title: 'Quota failure' })
      const events = []
      const result = await agentRunnerService.run({
        userId: OWNER,
        businessId: BUSINESS,
        threadId: thread.data.id,
        text: 'Hello',
        provider: 'stub',
        model: 'stub-model',
        apiKey: 'stub-key',
        apiBaseUrl: failing.url,
      }, event => { events.push(event) })

      assert.equal(result.success, false)
      assert.match(result.error ?? '', /exceeded your current quota/, 'plain provider message surfaces')
      assert.equal(result.code, 'PROVIDER_QUOTA_EXCEEDED')
      assert.ok(!String(result.error).includes('RESOURCE_EXHAUSTED"'), 'no JSON envelope in the surfaced message')
      const errorEvent = events.find(event => event.type === 'error')
      assert.ok(errorEvent, 'error event streamed')
      assert.match(errorEvent.message ?? '', /exceeded your current quota/)
    }
    finally {
      await failing.close()
    }
  })
})