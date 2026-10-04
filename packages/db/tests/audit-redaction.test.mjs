import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createLogger, withAuditMethods, mockAudit } from 'evlog'
import { initTestDb, insertUser } from './setup.mjs'

// The audit sink is the last place a secret can be stopped. Every current call
// site hand-picks non-sensitive fields, but nothing at the sink enforces that,
// so one careless caller writes a live OAuth token into the audit table and the
// log drain. This pins the sink's own guarantee.
//
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/audit-redaction.test.mjs

const OWNER = 'owner-audit-redact'
const BEARER = 'EAAB-secret-access-token-value'
const REFRESH = 'secret-refresh-token-value'

let db, schema, cleanup, auditSvc

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'auditredact@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  auditSvc = (await import('#layers/BaseDB/server/services/auditLog.service.ts')).logAuditService
})

after(() => cleanup())

async function storedDetails(targetId) {
  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(await import('drizzle-orm').then(m => m.eq(schema.auditLog.targetId, targetId)))
  return String(rows[0]?.details ?? '')
}

describe('audit sink redacts secrets', () => {
  it('strips a bearer token from details before it is persisted', async () => {
    await auditSvc.logAuditEvent({
      userId: OWNER,
      category: 'verify',
      action: 'VERIFY_BEARER',
      targetType: 'canary',
      targetId: 'bearer-1',
      status: 'success',
      details: `provider=twitter access_token=${BEARER}`,
    })

    const stored = await storedDetails('bearer-1')
    assert.equal(stored.includes(BEARER), false, `bearer token reached the audit table: ${stored}`)
    assert.equal(stored.includes('[REDACTED]'), true, 'expected a redaction marker')
  })

  it('strips an accessToken and a refreshToken pair', async () => {
    await auditSvc.logAuditEvent({
      userId: OWNER,
      category: 'verify',
      action: 'VERIFY_PAIR',
      targetType: 'canary',
      targetId: 'pair-1',
      status: 'success',
      details: `accountId=acct-1 accessToken=${BEARER} refreshToken=${REFRESH}`,
    })

    const stored = await storedDetails('pair-1')
    assert.equal(stored.includes(BEARER), false, 'accessToken leaked')
    assert.equal(stored.includes(REFRESH), false, 'refreshToken leaked')
  })

  it('redacts a JSON-encoded token inside details', async () => {
    await auditSvc.logAuditEvent({
      userId: OWNER,
      category: 'verify',
      action: 'VERIFY_JSON',
      targetType: 'canary',
      targetId: 'json-1',
      status: 'success',
      details: JSON.stringify({ provider: 'instagram', accessToken: BEARER, username: 'shop' }),
    })

    const stored = await storedDetails('json-1')
    assert.equal(stored.includes(BEARER), false, 'token inside a JSON payload leaked')
    assert.equal(stored.includes('shop'), true, 'redaction must not drop non-secret fields')
  })

  it('keeps ordinary audit detail readable', async () => {
    await auditSvc.logAuditEvent({
      userId: OWNER,
      category: 'verify',
      action: 'VERIFY_PLAIN',
      targetType: 'canary',
      targetId: 'plain-1',
      status: 'success',
      details: 'provider=threads username=someuser from THREADS',
    })

    const stored = await storedDetails('plain-1')
    assert.equal(stored, 'provider=threads username=someuser from THREADS')
  })

  it('redacts on the evlog drain too, not only in the database', async () => {
    const captured = mockAudit()
    try {
      const log = withAuditMethods(createLogger())
      await auditSvc.logAuditEvent({
        userId: OWNER,
        category: 'verify',
        action: 'VERIFY_EVLOG',
        targetType: 'canary',
        targetId: 'evlog-1',
        status: 'success',
        details: `accessToken=${BEARER}`,
      }, { log })
      await log.emit()
      const json = JSON.stringify(captured)
      assert.equal(json.includes(BEARER), false, `token reached the log drain: ${json}`)
    }
    finally {
      captured.restore()
    }
  })
})