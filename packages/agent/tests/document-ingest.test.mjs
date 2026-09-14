import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// T08 — RAG port: chunking, hash dedupe, Turso vector search, retrieve tool.
const OWNER = 'rag-owner'
const BUSINESS = 'rag-business'

let db
let schema
let cleanup
let documentIngestService
let createAgentTools
let createAgentToolContext

// Deterministic embedder: [alpha, beta, gamma] word counts.
function embedText(text) {
  const words = text.toLowerCase().split(/\W+/)
  return [
    words.filter(word => word === 'alpha').length,
    words.filter(word => word === 'beta').length,
    words.filter(word => word === 'gamma').length,
  ]
}

async function embedder(texts) {
  return texts.map(embedText)
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'rag@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'RAG Co' })
  ;({ documentIngestService } = await import('#layers/BaseDB/server/services/document-ingest.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
})

after(() => cleanup())

describe('document ingestion (T08)', () => {
  it('chunks text with overlap and hashes deterministically', async () => {
    const { chunkText, hashContent } = await import('#layers/BaseDB/server/services/document-ingest.service.ts')
    const text = 'a'.repeat(3000)
    const chunks = chunkText(text, { maxChars: 1000, overlap: 100 })
    assert.equal(chunks.length, 4)
    assert.equal(chunks[0].length, 1000)
    assert.equal(hashContent('same'), hashContent('same'))
    assert.notEqual(hashContent('same'), hashContent('different'))
    assert.deepEqual(chunkText('   '), [])
  })

  it('dedupes identical documents and stores chunks with embeddings', async () => {
    const first = await documentIngestService.ingest(OWNER, {
      filename: 'alpha.md',
      mimeType: 'text/markdown',
      text: 'alpha alpha alpha onboarding guide',
    }, embedder)
    assert.equal(first.success, true)
    assert.equal(first.data.deduped, false)
    assert.equal(first.data.chunks, 1)

    const second = await documentIngestService.ingest(OWNER, {
      filename: 'alpha.md',
      mimeType: 'text/markdown',
      text: 'alpha alpha alpha onboarding guide',
    }, embedder)
    assert.equal(second.success, true)
    assert.equal(second.data.deduped, true)
    assert.equal(second.data.document.id, first.data.document.id)

    const stored = await db.select().from(schema.documentChunks)
    assert.equal(stored.length, 1)
    assert.ok(stored[0].embedding)
  })

  it('returns the nearest chunk for a query', async () => {
    await documentIngestService.ingest(OWNER, {
      filename: 'beta.md',
      mimeType: 'text/markdown',
      text: 'beta beta beta launch checklist',
    }, embedder)

    const result = await documentIngestService.search(OWNER, { query: 'alpha' }, embedder)
    assert.equal(result.success, true)
    assert.equal(result.data.length, 2)
    assert.match(result.data[0].content, /alpha/)
    assert.ok(result.data[0].distance <= result.data[1].distance)
  })

  it('retrieve tool returns seeded chunks scoped to the user', async () => {
    const context = createAgentToolContext({ userId: OWNER, businessId: BUSINESS, embed: embedder })
    const tool = createAgentTools(context).find(entry => entry.name === 'retrieve')
    const result = await tool.execute('call-1', { query: 'beta' }, undefined, undefined, undefined)
    const payload = JSON.parse(result.content[0].text)
    assert.equal(payload.chunks.length, 2)
    assert.match(payload.chunks[0].content, /beta/)
  })

  it('rejects unsupported document types', async () => {
    const { parseDocumentText } = await import('#layers/BaseDB/server/services/document-ingest.service.ts')
    const result = await parseDocumentText({
      filename: 'data.bin',
      mimeType: 'application/octet-stream',
      base64: Buffer.from('binary').toString('base64'),
    })
    assert.equal(result.success, false)
    assert.equal(result.code, 'UNSUPPORTED_TYPE')
  })
})
