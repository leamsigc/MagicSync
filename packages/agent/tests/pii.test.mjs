import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'
import { writeStubModelsConfig } from './stub-models.mjs'
import { applyRunApiKey, createAgentModelRuntime } from '../server/utils/pi-runtime.ts'
import { anonymizeWithRegex, detectRegex, restore, safeCutPoint, SurrogateRestorer, isPiiReady } from '../server/agent/plugins/pii/detect.ts'

// T09 — PII private mode: regex round trip, streaming restore, fail-closed, and
// provider payloads that contain no raw PII.
const OWNER = 'pii-owner'
const BUSINESS = 'pii-business'
const EMAIL = 'john.doe@example.com'

let db
let schema
let cleanup
let chatService
let agentRunnerService
let runtime
let stub
let dir

function runPrivate(text) {
  return chatService.createThread(OWNER, { title: 'PII thread' }).then((thread) => {
    const events = []
    return agentRunnerService.run({
      userId: OWNER,
      businessId: BUSINESS,
      threadId: thread.data.id,
      text,
      provider: 'stub',
      model: 'stub-model',
      modelRuntime: runtime,
      privateMode: true,
    }, event => { events.push(event) }).then(result => ({ result, events, threadId: thread.data.id }))
  })
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'pii@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'PII Co' })
  ;({ chatService } = await import('#layers/BaseDB/server/services/chat.service.ts'))
  ;({ agentRunnerService } = await import('../server/services/agent-runner.service.ts'))
  stub = await startStubProvider({ toolName: 'echo_note', finalText: `Contact ${'[EMAIL_1]'} now.` })
  dir = mkdtempSync(join(tmpdir(), 'agent-pii-'))
  const modelsPath = writeStubModelsConfig(dir, stub.url)
  runtime = await createAgentModelRuntime({ modelsPath })
  await applyRunApiKey(runtime, 'stub', 'stub-key')
})

after(async () => {
  await stub.close()
  rmSync(dir, { recursive: true, force: true })
  await cleanup()
})

describe('pii private mode (T09)', () => {
  it('detects, anonymizes, and restores regex PII', () => {
    const detected = detectRegex(`Mail ${EMAIL} or call +1 555 123 4567`)
    assert.ok(detected.some(match => match.type === 'EMAIL'))
    assert.ok(detected.some(match => match.type === 'PHONE'))

    const { text, mappings } = anonymizeWithRegex(`Mail ${EMAIL}`)
    assert.ok(!text.includes(EMAIL))
    assert.equal(restore(text, mappings), `Mail ${EMAIL}`)
  })

  it('never splits surrogates across streamed deltas', () => {
    const restorer = new SurrogateRestorer([{ surrogate: '[EMAIL_1]', value: EMAIL }])
    const first = restorer.push('Contact [EMA')
    const second = restorer.push('IL_1] now')
    assert.equal(first, 'Contact ')
    assert.equal(second, `${EMAIL} now`)
    assert.equal(first + second, `Contact ${EMAIL} now`)
    assert.equal(safeCutPoint('plain text'), 'plain text'.length)
  })

  it('fails closed when the PII model is missing', async () => {
    const previous = process.env.PII_ALLOW_REGEX_ONLY
    delete process.env.PII_ALLOW_REGEX_ONLY
    assert.equal(isPiiReady(), false)

    const requestsBefore = stub.requests.length
    const { result, events } = await runPrivate(`Mail ${EMAIL}`)
    if (previous) process.env.PII_ALLOW_REGEX_ONLY = previous

    assert.equal(result.success, false)
    assert.equal(result.code, 'PII_MODEL_MISSING')
    assert.equal(events.at(-1)?.type, 'error')
    assert.equal(events.at(-1)?.code, 'PII_MODEL_MISSING')
    assert.equal(stub.requests.length, requestsBefore, 'no provider request is made')
  })

  it('sends only surrogates to the provider and restores output', async () => {
    process.env.PII_ALLOW_REGEX_ONLY = '1'
    const requestsBefore = stub.requests.length
    const { result, events, threadId } = await runPrivate(`Mail ${EMAIL} please`)
    delete process.env.PII_ALLOW_REGEX_ONLY

    assert.equal(result.success, true, result.error ?? '')
    const providerPayload = JSON.stringify(stub.requests[requestsBefore])
    assert.ok(!providerPayload.includes(EMAIL), 'raw PII never reaches the provider')
    assert.ok(providerPayload.includes('EMAIL_1'), 'surrogate reaches the provider')

    const streamed = events.filter(event => event.type === 'text.delta').map(event => event.delta).join('')
    assert.ok(streamed.includes(EMAIL), 'streamed output is restored')

    const mappings = await db.select().from(schema.piiMappings).where(eq(schema.piiMappings.threadId, threadId))
    assert.equal(mappings.length, 1)
    assert.equal(mappings[0].value, EMAIL)
  })
})
