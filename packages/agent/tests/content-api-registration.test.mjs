import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import './h3-globals.mjs'
import { initTestDb } from './setup.mjs'

/**
 * Registration guard for the simple content API routes.
 *
 * `runContentApi` used to import `runCapability` from `capabilities/registry`
 * instead of the `capabilities` aggregator. Only the aggregator runs
 * `import './content'`, so the registry stayed empty and every
 * `POST /api/v1/content/*` failed at runtime with
 * `422 Unknown capability: content.scan` (CAPABILITY_UNKNOWN) — while the unit
 * tests stayed green, because they imported the aggregator themselves.
 *
 * The assertion below is deliberately the ONLY thing this file does: import the
 * route adapter and prove it registers what it calls. Do not add the aggregator
 * to this file's imports — that would recreate the exact false-green that hid
 * this bug.
 */

const ROUTE_CAPABILITIES = {
  'content.scan': '../server/api/v1/content/scan.post.ts',
  'content.write': '../server/api/v1/content/write.post.ts',
  'content.publish': '../server/api/v1/content/publish.post.ts',
  'content.move': '../server/api/v1/content/move.post.ts',
  'content.update': '../server/api/v1/content/update.post.ts',
  'content.delete': '../server/api/v1/content/delete.post.ts',
  'content.fix': '../server/api/v1/content/fix.post.ts',
  'content.social.publish': '../server/api/v1/content/social-publish.post.ts',
  'content.check': '../server/api/v1/content/check.post.ts',
}

describe('content API route registration', () => {
  let cleanup

  before(async () => {
    const init = await initTestDb()
    cleanup = init.cleanup
  })

  after(() => cleanup?.())

  it('registers every content capability from the adapter alone', async () => {
    await import('../server/utils/content-api-route.ts')
    const { capabilityRegistry } = await import('../server/capabilities/registry.ts')
    for (const id of Object.keys(ROUTE_CAPABILITIES)) {
      assert.equal(capabilityRegistry.has(id), true, `capability "${id}" is not registered`)
    }
  })

  it('each content route module resolves to a registered capability', async () => {
    const { capabilityRegistry } = await import('../server/capabilities/registry.ts')
    await import('../server/utils/content-api-route.ts')
    for (const [id, route] of Object.entries(ROUTE_CAPABILITIES)) {
      if (route) await import(route)
      assert.equal(capabilityRegistry.has(id), true, `"${id}" missing after loading ${route ?? 'the aggregator'}`)
    }
  })

  it('still rejects an unknown capability instead of silently succeeding', async () => {
    await import('../server/utils/content-api-route.ts')
    const { runCapability } = await import('../server/capabilities/registry.ts')
    const outcome = await runCapability('content.not-a-capability', {}, {})
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'CAPABILITY_UNKNOWN')
  })
})