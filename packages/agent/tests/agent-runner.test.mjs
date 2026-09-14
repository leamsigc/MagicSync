import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineTool } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'
import { writeStubModelsConfig } from './stub-models.mjs'
import { applyRunApiKey, createAgentModelRuntime } from '../server/utils/pi-runtime.ts'

const OWNER = 'runner-owner'
const BUSINESS = 'runner-business'

const echoNote = defineTool({
  name: 'echo_note',
  label: 'Echo Note',
  description: 'Echo a note back to the model.',
  parameters: Type.Object({ note: Type.String() }),
  execute: async (_toolCallId, params) => ({
    content: [{ type: 'text', text: `note: ${params.note}` }],
    details: {},
  }),
})

let db
let schema
let cleanup
let chatService
let agentSessionService
let agentRunnerService
let runtime
let stub
let dir

async function runChat(text, overrides = {}) {
  const thread = await chatService.createThread(OWNER, { title: text.slice(0, 40) })
  const events = []
  const result = await agentRunnerService.run({
    userId: OWNER,
    businessId: BUSINESS,
    threadId: thread.data.id,
    text,
    provider: 'stub',
    model: 'stub-model',
    modelRuntime: runtime,
    customTools: [echoNote],
    ...overrides,
  }, (event) => { events.push(event) })
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
  stub = await startStubProvider({ toolName: 'echo_note', finalText: 'Runner done.' })
  dir = mkdtempSync(join(tmpdir(), 'agent-runner-'))
  const modelsPath = writeStubModelsConfig(dir, stub.url)
  runtime = await createAgentModelRuntime({ modelsPath })
  await applyRunApiKey(runtime, 'stub', 'stub-key')
})

after(async () => {
  await stub.close()
  rmSync(dir, { recursive: true, force: true })
  await cleanup()
})

describe('agent runner (T03)', () => {
  it('streams contract events and persists session, chat, and run rows', async () => {
    const { result, events, threadId } = await runChat('Run the echo tool.')

    assert.equal(result.success, true, result.error ?? '')
    const types = events.map(event => event.type)
    assert.ok(types.includes('message.started'))
    assert.ok(types.indexOf('message.started') < types.indexOf('tool.started'))
    assert.ok(types.indexOf('tool.started') < types.indexOf('tool.finished'))
    assert.ok(types.indexOf('tool.finished') < types.indexOf('text.delta'))
    assert.equal(types.at(-1), 'message.completed')
    assert.ok(events.every(event => String(event.id).startsWith(`${result.data.runId}:`)), 'stable event ids')

    const entries = await agentSessionService.loadEntries(OWNER, result.data.sessionId)
    assert.equal(entries.success, true)
    assert.ok(entries.data.length > 0, 'pi entries persisted for restore')

    const messages = await chatService.getMessages(threadId, OWNER)
    assert.equal(messages.data.length, 2)
    assert.equal(messages.data[1].content, 'Runner done.')

    const [runRow] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, result.data.runId))
    assert.equal(runRow.status, 'completed')
    assert.ok(JSON.parse(runRow.toolEvents).length >= 2)
  })

  it('continues a stored session with increasing entry seq', async () => {
    const first = await runChat('First turn.')
    const second = await runChat('Second turn.', { sessionId: first.result.data.sessionId })
    assert.equal(second.result.success, true)
    assert.equal(second.result.data.sessionId, first.result.data.sessionId)

    const entries = await agentSessionService.loadEntries(OWNER, first.result.data.sessionId)
    const seqs = entries.data.map(row => row.seq)
    assert.deepEqual(seqs, seqs.map((_seq, index) => index + 1), 'seq is monotonic 1..n across runs')
    assert.ok(entries.data.length > 4)
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
})
