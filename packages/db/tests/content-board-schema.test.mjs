import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

// T02 — agent content tables apply on a fresh database and the
// pi session entry sequence is protected by a unique index.
const OWNER = 'board-schema-owner'
const BUSINESS = 'board-schema-business'
const TABLES = [
  'content_items',
  'content_item_events',
  'content_checks',
  'content_runs',
  'agent_chat_sessions',
  'agent_chat_entries',
]

let db
let schema
let client
let cleanup
let sessionId
let artifactService

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  client = init.client
  cleanup = init.cleanup
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  artifactService = (await import('#layers/BaseDB/server/services/content-artifact.service.ts')).contentArtifactService
  await insertUser(db, { id: OWNER, email: 'board-schema@test.local' })
  await db.insert(schema.businessProfiles).values({ id: BUSINESS, userId: OWNER, name: 'Board Schema Co' })
  const [session] = await db.insert(schema.agentChatSessions).values({
    id: 'schema-session',
    businessId: BUSINESS,
    ownerUserId: OWNER,
    piSessionId: 'pi-schema',
  }).returning()
  sessionId = session.id
})

after(() => cleanup())

describe('content board schema (T02)', () => {
  it('creates every §6 table on a fresh database', async () => {
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    const names = result.rows.map(row => String(row.name))
    for (const table of TABLES) {
      assert.ok(names.includes(table), `missing table ${table}`)
    }
  })

  it('lists artifacts through the service without requiring revision history', async () => {
    await db.insert(schema.contentArtifacts).values({
      id: 'schema-artifact',
      ownerUserId: OWNER,
      businessId: BUSINESS,
      kind: 'social_post',
      outputKind: 'social_post_draft',
      status: 'review_required',
      output: JSON.stringify({ title: 'A draft' }),
      createdBy: OWNER,
    })
    const result = await artifactService.listArtifacts(OWNER, { businessId: BUSINESS })
    assert.equal(result.success, true)
    assert.equal(result.data.length, 1)
    assert.equal(result.data[0].id, 'schema-artifact')
    assert.equal(result.data[0].status, 'review_required')
  })

  it('enforces unique (session_id, seq)', async () => {
    await db.insert(schema.agentChatEntries).values({
      id: 'entry-a',
      sessionId,
      seq: 1,
      entry: { type: 'message', text: 'first' },
    })
    await assert.rejects(
      db.insert(schema.agentChatEntries).values({
        id: 'entry-b',
        sessionId,
        seq: 1,
        entry: { type: 'message', text: 'duplicate' },
      }),
    )
  })

  it('cascades entries when the session is removed', async () => {
    await client.execute('PRAGMA foreign_keys = ON')
    await db.delete(schema.agentChatSessions).where(eq(schema.agentChatSessions.id, sessionId))
    const rows = await db.select().from(schema.agentChatEntries)
    assert.equal(rows.length, 0)
  })
})
