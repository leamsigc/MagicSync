import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb } from './setup.mjs'

/**
 * Self-heal guard for the capability registry.
 *
 * This file deliberately imports `capabilities/registry` and NOTHING else —
 * no `index.ts`, no route adapter. That mirrors an adapter which reaches the
 * registry without pulling the aggregator, and it leaves `capabilityRegistry`
 * genuinely empty at import time.
 *
 * Nitro code-splits every route into its own chunk, so a route can hold its own
 * copy of the `capabilityRegistry` singleton while the aggregator's
 * `import './content'` side effect ran in a different chunk. That is how
 * `POST /api/v1/content/scan` shipped a `422 Unknown capability: content.scan`
 * (CAPABILITY_UNKNOWN) while the unit suite stayed green.
 *
 * `runCapability` therefore loads the aggregator into its own module graph on
 * a lookup miss. If that self-heal regresses, the first test below fails.
 * Do NOT add an `index.ts` import to this file — that is the bug it guards.
 */

const REGISTRY = '../server/capabilities/registry.ts'

describe('capability registry self-heal', () => {
  let cleanup

  before(async () => {
    const init = await initTestDb()
    cleanup = init.cleanup
  })

  after(() => cleanup?.())

  it('starts empty — this file loaded no aggregator', async () => {
    const { capabilityRegistry } = await import(REGISTRY)
    assert.equal(capabilityRegistry.has('content.scan'), false)
  })

  it('resolves every route capability from the bare registry module', async () => {
    const { runCapability } = await import(REGISTRY)
    for (const id of ['content.scan', 'content.write', 'content.publish', 'content.check']) {
      const outcome = await runCapability(id, { nonsense: true }, {})
      assert.notEqual(
        outcome.code,
        'CAPABILITY_UNKNOWN',
        `"${id}" did not self-register — the registry lost its lazy aggregator load`,
      )
    }
  })

  it('still reports CAPABILITY_UNKNOWN for an id that is genuinely absent', async () => {
    const { runCapability } = await import(REGISTRY)
    const outcome = await runCapability('content.definitely-not-a-capability', {}, {})
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'CAPABILITY_UNKNOWN')
  })
})