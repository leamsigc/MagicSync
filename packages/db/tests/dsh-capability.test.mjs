import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

// T30.2 — Nuxt DSH capability issuance (HS256, magicsync-dsh audience).
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/dsh-capability.test.mjs

process.env.DSH_BRIDGE_SECRET = 'test-bridge-secret'

let issueDshCapability
let verifyDshCapability

before(async () => {
  const mod = await import('#layers/BaseDB/server/utils/dsh-capability.ts')
  issueDshCapability = mod.issueDshCapability
  verifyDshCapability = mod.verifyDshCapability
})

function claims() {
  return {
    sub: 'user-1',
    businessId: 'biz-1',
    workflowId: 'wf-1',
    runId: 'run-1',
    allowedTools: ['web_search'],
    allowedSkills: ['social-research'],
  }
}

describe('dsh-capability (T30.2)', () => {
  it('issues and verifies a round trip', async () => {
    const token = await issueDshCapability(claims())
    const decoded = await verifyDshCapability(token)
    assert.equal(decoded.sub, 'user-1')
    assert.equal(decoded.businessId, 'biz-1')
    assert.deepEqual(decoded.allowedTools, ['web_search'])
    assert.ok(decoded.nonce)
  })

  it('rejects tampered tokens', async () => {
    const token = await issueDshCapability(claims())
    const [head, body] = token.split('.')
    await assert.rejects(verifyDshCapability(`${head}.${body}.AAAA`))
  })

  it('rejects out-of-range TTLs', async () => {
    await assert.rejects(issueDshCapability(claims(), 0))
    await assert.rejects(issueDshCapability(claims(), 99999))
  })
})
