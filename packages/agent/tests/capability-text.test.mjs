import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb } from './setup.mjs'

/**
 * T20: `text.generate` — the capability replacing the deleted raw
 * prompt-to-text escape hatch (PRD §3.7). Verified with a scripted
 * completion — no network, no API keys, no DB.
 */

let cleanupDb
let runCapability

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  const registry = await import('../server/capabilities/registry.ts')
  runCapability = registry.runCapability
  await import('../server/capabilities/text.ts')
})

after(() => cleanupDb())

const completeScripted = (response) => async () => response

function baseCtx(overrides = {}) {
  return {
    userId: 'u-text',
    businessId: 'b-text',
    complete: completeScripted('plain text answer'),
    systemContext: '',
    ...overrides,
  }
}

describe('capability text.generate (T20)', () => {
  it('returns validated { text, json } output', async () => {
    const outcome = await runCapability(
      'text.generate',
      { prompt: 'Give me a JSON plan', system: 'You are a planner.' },
      baseCtx({ complete: completeScripted('{"title":"Plan","items":[1,2]}') }),
    )
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.text, '{"title":"Plan","items":[1,2]}')
    assert.deepEqual(outcome.output.json, { title: 'Plan', items: [1, 2] })
  })

  it('extracts embedded JSON from surrounding prose', async () => {
    const outcome = await runCapability(
      'text.generate',
      { prompt: 'Say hi and give JSON' },
      baseCtx({ complete: completeScripted('Here you go: {"ok":true} — done!') }),
    )
    assert.equal(outcome.ok, true)
    assert.deepEqual(outcome.output.json, { ok: true })
  })

  it('keeps json null for non-JSON responses', async () => {
    const outcome = await runCapability('text.generate', { prompt: 'Just talk' }, baseCtx())
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.text, 'plain text answer')
    assert.equal(outcome.output.json, null)
  })

  it('rejects empty prompts with VALIDATION_ERROR', async () => {
    const outcome = await runCapability('text.generate', { prompt: '' }, baseCtx())
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'VALIDATION_ERROR')
  })

  it('rejects unknown capabilities with CAPABILITY_UNKNOWN', async () => {
    const outcome = await runCapability('text.nope', { prompt: 'x' }, baseCtx())
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'CAPABILITY_UNKNOWN')
  })

  it('maps completion failures to a typed error, never throws', async () => {
    const outcome = await runCapability(
      'text.generate',
      { prompt: 'boom' },
      baseCtx({ complete: async () => { throw new Error('model unavailable') } }),
    )
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'CAPABILITY_FAILED')
    assert.match(outcome.error, /model unavailable/)
  })
})
