import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createLogger, withAuditMethods, mockAudit } from 'evlog'
import { initTestDb, insertUser } from './setup.mjs'

// evlog dual-write: DB auditLog stays the system of record, the same fact is
// emitted onto the request wide event for the log drains.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/evlog-audit.test.mjs

const OWNER = 'owner-audit-evlog'

let db
let schema
let cleanup
let auditSvc
let helpers

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'auditevlog@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  auditSvc = (await import('#layers/BaseDB/server/services/auditLog.service.ts')).logAuditService
  helpers = await import('#layers/BaseShared/server/utils/evlog.ts')
})

after(() => cleanup())

describe('evlog audit helpers', () => {
  it('emits audit facts onto the wide event', async () => {
    const captured = mockAudit()
    try {
      const log = withAuditMethods(createLogger())
      helpers.auditEvent(log, {
        action: 'api-key.create',
        actorId: OWNER,
        targetType: 'api-key',
        targetId: 'key-1',
        outcome: 'success',
        reason: 'test',
      })
      await log.emit()
      assert.equal(captured.toIncludeAuditOf({
        action: 'api-key.create',
        outcome: 'success',
        actor: { id: OWNER },
        target: { type: 'api-key', id: 'key-1' },
      }), true)
    } finally {
      captured.restore()
    }
  })

  it('omits target when incomplete and defaults outcome to success', async () => {
    const captured = mockAudit()
    try {
      const log = withAuditMethods(createLogger())
      helpers.auditEvent(log, { action: 'admin.ping', actorId: OWNER })
      await log.emit()
      const evt = captured.assertAudit({ action: 'admin.ping' })
      assert.equal(evt.target, undefined)
      assert.equal(evt.outcome, 'success')
    } finally {
      captured.restore()
    }
  })

  it('passes AI models through untouched without a request logger', () => {
    const model = { id: 'model-stub' }
    assert.equal(helpers.wrapAiModel(undefined, model), model)
    helpers.captureEmbedUsage(undefined, { tokens: 7 })
  })
})

describe('logAuditService dual-write', () => {
  it('writes the DB row and emits the same fact to evlog', async () => {
    const captured = mockAudit()
    try {
      const log = withAuditMethods(createLogger())
      await auditSvc.logAuditEvent({
        userId: OWNER,
        category: 'api-key',
        action: 'create',
        targetType: 'api-key',
        targetId: 'key-9',
        status: 'success',
        details: 'dual-write check',
      }, { log })
      await log.emit()
      const rows = await db.select().from(schema.auditLog)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].action, 'create')
      assert.equal(captured.toIncludeAuditOf({ action: 'create', actor: { id: OWNER } }), true)
    } finally {
      captured.restore()
    }
  })

  it('still writes the DB row when no request logger is available', async () => {
    await auditSvc.logAuditEvent({ userId: OWNER, category: 'mcp', action: 'tool-call', status: 'success' })
    const rows = await db.select().from(schema.auditLog)
    assert.ok(rows.length >= 1)
  })
})
