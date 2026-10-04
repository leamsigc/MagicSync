import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// T02 — durable pi sessions: monotonic entry sequencing + owner scoping.
const OWNER = 'agent-owner'
const OUTSIDER = 'agent-outsider'
const BUSINESS = 'agent-business'

let db
let schema
let cleanup
let agentSessionService
let sessionId

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'agent-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'agent-outsider@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Agent Co' })
  ;({ agentSessionService } = await import('../server/services/agent-session.service.ts'))
})

after(() => cleanup())

describe('agent session store (T02)', () => {
  it('creates a session and scopes reads to the owner', async () => {
    const created = await agentSessionService.createSession(OWNER, {
      businessId: BUSINESS,
      piSessionId: 'pi-session-1',
    })
    assert.equal(created.success, true)
    assert.equal(created.data.lastEntrySeq, 0)
    sessionId = created.data.id

    const ownerRead = await agentSessionService.getSession(OWNER, sessionId)
    assert.equal(ownerRead.success, true)

    const outsiderRead = await agentSessionService.getSession(OUTSIDER, sessionId)
    assert.equal(outsiderRead.success, false)
    assert.equal(outsiderRead.code, 'NOT_FOUND')
  })

  it('links a chat thread', async () => {
    const linked = await agentSessionService.linkThread(OWNER, sessionId, 'thread-1')
    assert.equal(linked.success, true)
    assert.equal(linked.data.threadId, 'thread-1')

  })

  it('appends entries with a monotonic seq and loads them in order', async () => {
    const first = await agentSessionService.appendEntries(OWNER, sessionId, [
      { type: 'message', text: 'a' },
      { type: 'message', text: 'b' },
    ])
    assert.equal(first.success, true)
    assert.deepEqual(first.data, { lastEntrySeq: 2, appended: 2 })

    const second = await agentSessionService.appendEntries(OWNER, sessionId, [
      { type: 'message', text: 'c' },
    ])
    assert.equal(second.data.lastEntrySeq, 3)

    const entries = await agentSessionService.loadEntries(OWNER, sessionId)
    assert.equal(entries.success, true)
    assert.deepEqual(entries.data.map(entry => entry.seq), [1, 2, 3])
    assert.deepEqual(entries.data.map(entry => entry.entry.text), ['a', 'b', 'c'])
  })

  it('refuses foreign appends and loads', async () => {
    const denied = await agentSessionService.appendEntries(OUTSIDER, sessionId, [{ type: 'message' }])
    assert.equal(denied.success, false)
    assert.equal(denied.code, 'NOT_FOUND')

    const entries = await agentSessionService.loadEntries(OUTSIDER, sessionId)
    assert.equal(entries.success, false)
    assert.equal(entries.code, 'NOT_FOUND')
  })

  it('enforces unique (session_id, seq) at the database level', async () => {
    await assert.rejects(
      db.insert(schema.agentChatEntries).values({
        id: crypto.randomUUID(),
        sessionId,
        seq: 1,
        entry: { type: 'message', text: 'duplicate' },
      }),
    )
  })
})
