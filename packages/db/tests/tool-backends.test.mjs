import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { and, eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

// Tool backends KV: encrypted secrets, presence flags, URL validation.
const OWNER = 'backends-owner'

let db
let schema
let cleanup
let toolBackendsService

async function rawDetails() {
  const [row] = await db
    .select()
    .from(schema.entityDetails)
    .where(and(eq(schema.entityDetails.entityId, OWNER), eq(schema.entityDetails.entityType, 'user_tool_backends')))
    .limit(1)
  return row?.details ?? null
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'backends@test.local' })
  ;({ toolBackendsService } = await import('#layers/BaseDB/server/services/tool-backends.service.ts'))
})

after(() => cleanup())

describe('tool backends (settings KV)', () => {
  it('saves, encrypts at rest, and reads back secrets', async () => {
    const saved = await toolBackendsService.save(OWNER, {
      scrapegraphApiKey: 'sgai_test_key_123',
      langsearchApiKey: 'ls_test_key_456',
      pythonBackendUrl: 'http://localhost:8100',
      pythonBackendToken: 'python-secret',
    })
    assert.equal(saved.success, true)
    assert.equal(saved.data.hasScrapegraphKey, true)
    assert.equal(saved.data.hasLangsearchKey, true)
    assert.equal(saved.data.hasPythonToken, true)
    assert.equal(saved.data.pythonBackendUrl, 'http://localhost:8100')

    const raw = await rawDetails()
    assert.match(raw.scrapegraphApiKey, /^enc:v1:/)
    assert.match(raw.langsearchApiKey, /^enc:v1:/)
    assert.ok(!JSON.stringify(raw).includes('sgai_test_key_123'), 'plaintext key never hits the row')
    assert.ok(!JSON.stringify(raw).includes('ls_test_key_456'), 'plaintext LangSearch key never hits the row')
    assert.ok(!JSON.stringify(raw).includes('python-secret'), 'plaintext token never hits the row')

    const loaded = await toolBackendsService.get(OWNER)
    assert.equal(loaded.data.scrapegraphApiKey, 'sgai_test_key_123')
    assert.equal(loaded.data.langsearchApiKey, 'ls_test_key_456')
    assert.equal(loaded.data.pythonBackendToken, 'python-secret')
  })

  it('keeps existing secrets when a patch omits them', async () => {
    const saved = await toolBackendsService.save(OWNER, { pythonBackendUrl: 'https://tools.example.com' })
    assert.equal(saved.success, true)
    assert.equal(saved.data.pythonBackendUrl, 'https://tools.example.com')
    assert.equal(saved.data.scrapegraphApiKey, 'sgai_test_key_123')
    assert.equal(saved.data.langsearchApiKey, 'ls_test_key_456')
    assert.equal(saved.data.pythonBackendToken, 'python-secret')
  })

  it('rejects non-http(s) backend URLs', async () => {
    const bad = await toolBackendsService.save(OWNER, { pythonBackendUrl: 'ftp://files.example.com' })
    assert.equal(bad.success, false)
    assert.equal(bad.code, 'VALIDATION_ERROR')
  })

  it('clears secrets with an empty string', async () => {
    const cleared = await toolBackendsService.save(OWNER, { scrapegraphApiKey: '', pythonBackendToken: '' })
    assert.equal(cleared.success, true)
    assert.equal(cleared.data.hasScrapegraphKey, false)
    assert.equal(cleared.data.hasPythonToken, false)
  })

  it('fails closed on legacy plaintext secrets', async () => {
    const now = new Date()
    await db.insert(schema.entityDetails).values({
      id: 'legacy-backends-row',
      entityId: 'legacy-user',
      entityType: 'user_tool_backends',
      details: { scrapegraphApiKey: 'plaintext-legacy-key', pythonBackendUrl: 'http://localhost:8100' },
      createdAt: now,
      updatedAt: now,
    })
    const loaded = await toolBackendsService.get('legacy-user')
    assert.equal(loaded.data.scrapegraphApiKey, null)
    assert.equal(loaded.data.hasScrapegraphKey, false)
  })
})
