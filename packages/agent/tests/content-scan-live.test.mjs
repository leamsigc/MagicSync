import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * LIVE end-to-end scan — no stubbed `complete`.
 *
 * Every other capability test injects a fake completion, which is why
 * "content.scan returns ideas" was green while the real application returned
 * nothing: the system default (`provider: 'google'`,
 * `model: 'gemini-3-flash-preview'`) was not in the pi catalog and pi-ai ships
 * no Google API implementation, so `complete` threw MODEL_NOT_AVAILABLE on
 * every real request, and the content-intelligence layer swallowed that into
 * an empty string. A stub can never catch this class of bug — only a real
 * model call can.
 *
 * Skipped unless a real key is present, so the hermetic suite stays hermetic:
 *   GOOGLE_LIVE=1 NUXT_GOOGLE_GENERATIVE_AI_API_KEY=… pnpm --filter …agent test
 *
 * What it guards: the system default must resolve against
 * `server/agent/models.json` and return real ideas.
 */

const LIVE = process.env.GOOGLE_LIVE === '1'
const KEY = process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
const OWNER = 'live-scan-owner'
const BUSINESS = 'live-scan-business'

describe('content.scan (live model)', { skip: LIVE && KEY ? false : 'set GOOGLE_LIVE=1 and a Google key' }, () => {
  let cleanup
  let runCapability
  let createAgentModelRuntime
  let resolveRunModel
  let createAgentComplete
  let SYSTEM_DEFAULT_PROVIDER
  let SYSTEM_DEFAULT_MODEL

  before(async () => {
    const init = await initTestDb()
    cleanup = init.cleanup
    await insertUser(init.db, { id: OWNER, email: 'live-scan@test.local' })
    await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Live Scan Co' })
    const caps = await import('../server/capabilities/index.ts')
    runCapability = caps.runCapability
    const pi = await import('../server/utils/pi-runtime.ts')
    createAgentModelRuntime = pi.createAgentModelRuntime
    resolveRunModel = pi.resolveRunModel
    createAgentComplete = pi.createAgentComplete
    const llm = await import('#layers/BaseDB/server/services/user-llm-config.service.ts')
    SYSTEM_DEFAULT_PROVIDER = llm.SYSTEM_DEFAULT_PROVIDER
    SYSTEM_DEFAULT_MODEL = llm.SYSTEM_DEFAULT_MODEL
  })

  after(() => cleanup?.())

  it('resolves the system default against the pi catalog', async () => {
    const runtime = await createAgentModelRuntime()
    const model = resolveRunModel(runtime, SYSTEM_DEFAULT_PROVIDER, SYSTEM_DEFAULT_MODEL)
    assert.ok(
      model,
      `system default ${SYSTEM_DEFAULT_PROVIDER}/${SYSTEM_DEFAULT_MODEL} is not in models.json — every capability run would fail with MODEL_NOT_AVAILABLE`,
    )
  })

  it('completes a real request with the system default', async () => {
    const runtime = await createAgentModelRuntime()
    const model = resolveRunModel(runtime, SYSTEM_DEFAULT_PROVIDER, SYSTEM_DEFAULT_MODEL)
    await assert.doesNotReject(async () => {
      await createAgentComplete(runtime, model, { callName: 'live.scan.probe' })({
        prompt: 'Reply with exactly: OK',
        maxTokens: 64,
      })
    })
  })

  it('returns real ideas from a live scan', async () => {
    const runtime = await createAgentModelRuntime()
    const model = resolveRunModel(runtime, SYSTEM_DEFAULT_PROVIDER, SYSTEM_DEFAULT_MODEL)
    const complete = createAgentComplete(runtime, model, { callName: 'content.scan' })
    const outcome = await runCapability('content.scan', { topic: 'roof maintenance', count: 3 }, {
      userId: OWNER,
      businessId: BUSINESS,
      complete: input => complete(input),
      systemContext: 'You write for a local roofing company.',
      event: undefined,
      log: undefined,
    })
    assert.equal(outcome.ok, true, `scan failed: ${JSON.stringify(outcome)}`)
    assert.ok(outcome.output.ideas.length > 0, 'live scan produced no ideas')
    assert.ok(outcome.output.ideas[0].title.length > 0)
  })

  it('surfaces a model failure as a coded error instead of empty ideas', async () => {
    const outcome = await runCapability('content.scan', { topic: 'anything' }, {
      userId: OWNER,
      businessId: BUSINESS,
      complete: () => Promise.reject(Object.assign(new Error('provider rejected the key'), { code: 'MODEL_NOT_AVAILABLE' })),
      systemContext: '',
      event: undefined,
      log: undefined,
    })
    // The research step runs before generation, so the code surfaces as
    // RESEARCH_FAILED here. What matters is that it is a CODED failure — the
    // old behaviour swallowed the error and returned `ideas: []`, which is
    // indistinguishable from a genuinely empty scan.
    assert.equal(outcome.ok, false)
    assert.ok(outcome.code, 'a model failure must carry a code, not return an empty result')
    assert.match(String(outcome.error), /provider rejected the key/)
  })
})