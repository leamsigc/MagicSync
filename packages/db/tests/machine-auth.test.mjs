import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { initTestDb, insertUser } from './setup.mjs'

// T100/T130 — HMAC machine auth over real SQLite.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/machine-auth.test.mjs

process.env.DSH_BRIDGE_SECRET = 'test-machine-secret'

const OWNER = 'machine-owner'

let cleanup
let svc

function headersFor(body) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', process.env.DSH_BRIDGE_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex')
  return { timestamp, signature }
}

function fakeEvent(headers) {
  return { headers }
}

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'machine-owner@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  globalThis.getHeader = (event, name) => event.headers[name.toLowerCase()] ?? undefined
  const auth = await import('#layers/BaseDB/server/utils/machine-auth.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...auth, ...profile }
})

after(() => cleanup())

describe('machine auth (T100/T130)', () => {
  it('verifies a well-formed signature', async () => {
    const biz = await svc.businessProfileService.create(OWNER, { name: 'Machine Co' })
    const rawBody = JSON.stringify({ businessId: biz.data.id })
    const { timestamp, signature } = headersFor(rawBody)
    const event = fakeEvent({ 'x-machine-timestamp': timestamp, 'x-machine-signature': signature })
    assert.equal(svc.verifyMachineRequest(event, rawBody), null)
    const authed = await svc.authenticateMachineRequest(event, rawBody)
    assert.equal(authed.success, true)
    assert.equal(authed.data.userId, OWNER)
  })

  it('rejects tampered, stale, and missing signatures', async () => {
    const rawBody = JSON.stringify({ businessId: 'x' })
    const { timestamp, signature } = headersFor(rawBody)
    const tampered = fakeEvent({ 'x-machine-timestamp': timestamp, 'x-machine-signature': `${signature}00` })
    assert.match(svc.verifyMachineRequest(tampered, rawBody) ?? '', /Invalid/)
    const stale = String(Math.floor(Date.now() / 1000) - 9999)
    const staleSig = createHmac('sha256', process.env.DSH_BRIDGE_SECRET).update(`${stale}.${rawBody}`).digest('hex')
    const staleEvent = fakeEvent({ 'x-machine-timestamp': stale, 'x-machine-signature': staleSig })
    assert.match(svc.verifyMachineRequest(staleEvent, rawBody) ?? '', /stale/)
    assert.match(svc.verifyMachineRequest(fakeEvent({}), rawBody) ?? '', /Missing/)
  })

  it('rejects unknown businesses after verifying the signature', async () => {
    const rawBody = JSON.stringify({ businessId: 'nope' })
    const { timestamp, signature } = headersFor(rawBody)
    const event = fakeEvent({ 'x-machine-timestamp': timestamp, 'x-machine-signature': signature })
    const authed = await svc.authenticateMachineRequest(event, rawBody)
    assert.equal(authed.success, false)
    assert.equal(authed.code, 'NOT_FOUND')
  })
})
