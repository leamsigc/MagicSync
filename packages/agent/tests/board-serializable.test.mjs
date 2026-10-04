import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initTestDb } from './setup.mjs'

let cleanupDb
before(async () => { cleanupDb = (await initTestDb()).cleanup })
after(async () => { await cleanupDb?.() })

// Flue rejects tool output that is not JSON-serializable. Drizzle timestamp
// columns arrive as Date, so the board summary must serialize them.
test('board card summaries serialize to JSON', async () => {
  const { summarizeCard } = await import('../server/agent/tools/board.tools.ts')
  const summary = summarizeCard({
    id: 'card-1',
    title: 'Launch post',
    state: 'idea',
    format: 'social_post',
    platforms: ['instagram'],
    brief: 'A launch brief',
    artifactId: null,
    updatedAt: new Date('2026-10-06T08:00:00.000Z'),
  })
  assert.equal(summary.updatedAt, '2026-10-06T08:00:00.000Z')
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), {
    id: 'card-1',
    title: 'Launch post',
    state: 'idea',
    format: 'social_post',
    platforms: ['instagram'],
    brief: 'A launch brief',
    artifactId: null,
    updatedAt: '2026-10-06T08:00:00.000Z',
  })
})
