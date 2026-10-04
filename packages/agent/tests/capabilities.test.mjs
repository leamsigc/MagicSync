import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T05: capability registry + runCapability single entry (PRD §4.4).
 * Verified with the deterministic goal router (zero model calls) plus
 * validation outcomes — no network, no API keys.
 */

let cleanupDb

const OWNER = 'cap-owner'
const BUSINESS = 'cap-business'

const completeNever = async () => { throw new Error('no model calls expected in routed runs') }

before(async () => {
  const init = await initTestDb()
  const db = init.db
  cleanupDb = init.cleanup
  await insertUser(db, { id: OWNER, email: 'cap@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Cap Co' })
  // Import registers builtin capabilities (agentic skills included).
  await import('../server/capabilities/goal.ts')
})

after(() => cleanupDb())

function baseCtx(overrides = {}) {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    complete: completeNever,
    systemContext: '',
    ...overrides,
  }
}

describe('capability registry + runCapability (T05)', () => {
  it('registers builtin capabilities', async () => {
    const { capabilityRegistry } = await import('../server/capabilities/registry.ts')
    assert.ok(capabilityRegistry.has('goal.plan'), 'goal.plan registered')
    const listed = capabilityRegistry.list()
    assert.ok(listed.some(c => c.id === 'goal.plan'))
  })

  it('routes a deterministic goal with zero model calls and validates output shape', async () => {
    const { runCapability } = await import('../server/capabilities/registry.ts')
    const outcome = await runCapability('goal.plan', { goal: 'Help me get more customers' }, baseCtx())
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.routed, true, 'keyword router matched without a model call')
    assert.ok(outcome.output.steps.length >= 2, 'routed plan has steps')
    assert.ok(outcome.output.steps.every(step => step.id && step.label), 'steps carry id + label for the step rail')
    assert.equal(typeof outcome.output.summary, 'string')
  })

  it('rejects unknown capabilities and invalid inputs with typed codes', async () => {
    const { runCapability } = await import('../server/capabilities/registry.ts')
    const unknown = await runCapability('nope.nada', {}, baseCtx())
    assert.equal(unknown.ok, false)
    assert.equal(unknown.code, 'CAPABILITY_UNKNOWN')

    const invalid = await runCapability('goal.plan', { goal: '' }, baseCtx())
    assert.equal(invalid.ok, false)
    assert.equal(invalid.code, 'VALIDATION_ERROR')
  })

  it('returns a structured model-planned goal when routing misses (bounded, validated)', async () => {
    const { runCapability } = await import('../server/capabilities/registry.ts')
    const scriptedComplete = async ({ prompt }) => JSON.stringify({
      goal: 'Custom goal xylophone',
      summary: 'A plan',
      steps: [{ id: 'create-content-ideas', skill: 'create-content-ideas', title: 'Ideas', type: 'creation', dependsOn: [] }],
    })
    const outcome = await runCapability('goal.plan', { goal: 'Custom goal xylophone' }, baseCtx({ complete: scriptedComplete }))
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.routed, false, 'router missed; model planning used')
    assert.equal(outcome.output.steps[0].id, 'create-content-ideas', 'model plan sanitized to known skills')
  })
})
