// TEMPORARY probe — delete after use. Detects hang vs error in templateService.findByOwner.
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser } from './setup.mjs'

const OWNER = 'tmpl-owner'
let cleanup
let templateService

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TIMED OUT after ${ms}ms: ${label}`)), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
}

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'tmpl-owner@test.local' })
  ;({ templateService } = await import('#layers/BaseDB/server/services/template.service.ts'))
})

after(() => cleanup())

describe('template probe', () => {
  it('findByOwner type=CHAT resolves (no hang)', async () => {
    const res = await withTimeout(
      templateService.findByOwner(OWNER, { pagination: { page: 1, limit: 20 }, filters: { type: 'CHAT' } }),
      15000,
      'findByOwner CHAT',
    )
    console.log('CHAT result:', JSON.stringify(res).slice(0, 200))
    assert.equal(res.success, true)
  })

  it('findByOwner type=VARIABLE resolves (no hang)', async () => {
    const res = await withTimeout(
      templateService.findByOwner(OWNER, { pagination: { page: 1, limit: 20 }, filters: { type: 'VARIABLE' } }),
      15000,
      'findByOwner VARIABLE',
    )
    console.log('VARIABLE result:', JSON.stringify(res).slice(0, 200))
    assert.equal(res.success, true)
  })
})
