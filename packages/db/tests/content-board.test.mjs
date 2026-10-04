import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

// Content Pipeline Overhaul — content board service: 6-state transitions,
// agent limits, artifact gates, Safe Mode default, and resetFailed.
const OWNER = 'board-owner'
const OUTSIDER = 'board-outsider'
const BUSINESS = 'board-business'

let db
let schema
let cleanup
let contentBoardService
let contentArtifactService

async function walk(itemId, states) {
  for (const state of states) {
    const moved = await contentBoardService.move(OWNER, BUSINESS, itemId, state, { actorKind: 'agent' })
    assert.equal(moved.success, true, `agent move to ${state}: ${moved.error ?? ''}`)
  }
}

async function makeReviewRequired() {
  const created = await contentBoardService.create(OWNER, BUSINESS, { title: `Card ${crypto.randomUUID()}` })
  assert.equal(created.success, true)
  await walk(created.data.id, ['drafting', 'review_required'])
  return created.data.id
}

async function attachApprovedArtifact(itemId, caption = 'Hello') {
  const submitted = await contentArtifactService.submitArtifact(OWNER, {
    businessId: BUSINESS,
    kind: 'social_post',
    outputKind: 'social_post_draft',
    output: { outputKind: 'social_post_draft', caption, platformVariants: {}, slideCopy: [], cta: '', claims: [], sources: [] },
  })
  assert.equal(submitted.success, true)
  const reviewed = await contentArtifactService.reviewArtifact(OWNER, submitted.data.id, BUSINESS, {
    decision: 'approved',
    feedback: '',
    version: 1,
  })
  assert.equal(reviewed.success, true)
  await db.update(schema.contentItems).set({ artifactId: submitted.data.id }).where(eq(schema.contentItems.id, itemId))
  return submitted.data.id
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'board-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'board-outsider@test.local' })
  await db.insert(schema.businessProfiles).values({ id: BUSINESS, userId: OWNER, name: 'Board Co' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ contentArtifactService } = await import('#layers/BaseDB/server/services/content-artifact.service.ts'))
})

after(() => cleanup())

describe('content board (6-state)', () => {
  it('walks agent-allowed transitions up to review_required and blocks agent moves to scheduled', async () => {
    const itemId = await makeReviewRequired()
    const approval = await contentBoardService.move(OWNER, BUSINESS, itemId, 'scheduled', { actorKind: 'agent' })
    assert.equal(approval.success, false)
    assert.equal(approval.code, 'HUMAN_ACTION_REQUIRED')
  })

  it('only a human-approved artifact unlocks scheduled', async () => {
    const itemId = await makeReviewRequired()
    const early = await contentBoardService.move(OWNER, BUSINESS, itemId, 'scheduled', { actorKind: 'user' })
    assert.equal(early.success, false)
    assert.equal(early.code, 'ARTIFACT_REQUIRED')

    await attachApprovedArtifact(itemId)
    const human = await contentBoardService.move(OWNER, BUSINESS, itemId, 'scheduled', { actorKind: 'user' })
    assert.equal(human.success, true)
  })

  it('rejects invalid transitions and foreign business access', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Card B' })
    const invalid = await contentBoardService.move(OWNER, BUSINESS, created.data.id, 'published', { actorKind: 'user' })
    assert.equal(invalid.success, false)
    assert.equal(invalid.code, 'INVALID_TRANSITION')

    const foreign = await contentBoardService.move(OUTSIDER, BUSINESS, created.data.id, 'drafting', { actorKind: 'agent' })
    assert.equal(foreign.success, false)
    assert.equal(foreign.code, 'NOT_FOUND')
  })

  it('resets a failed card back to idea with cleared error and retry count', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Card F' })
    await db.update(schema.contentItems).set({ state: 'failed', lastError: 'boom', retryCount: 2 })
      .where(eq(schema.contentItems.id, created.data.id))
    const reset = await contentBoardService.resetFailed(OWNER, BUSINESS, created.data.id, { actorKind: 'user' })
    assert.equal(reset.success, true, reset.error ?? '')
    assert.equal(reset.data.item.state, 'idea')
    assert.equal(reset.data.item.lastError, null)
    assert.equal(reset.data.item.retryCount, 0)

    const notFailed = await contentBoardService.resetFailed(OWNER, BUSINESS, created.data.id, { actorKind: 'user' })
    assert.equal(notFailed.success, false)
    assert.equal(notFailed.code, 'INVALID_TRANSITION')
  })

  it('appends audit events for create and every move', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Card Events' })
    await contentBoardService.move(OWNER, BUSINESS, created.data.id, 'drafting', { actorKind: 'agent' })
    const events = await contentBoardService.listEvents(OWNER, BUSINESS, created.data.id)
    assert.equal(events.success, true)
    assert.deepEqual(events.data.map(event => event.event), ['created', 'state_changed'])
    assert.equal(events.data[1].fromState, 'idea')
    assert.equal(events.data[1].toState, 'drafting')
    assert.equal(events.data[1].actorKind, 'agent')
  })

  it('records checks for a card', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Card Checks' })
    const check = await contentBoardService.recordCheck(OWNER, BUSINESS, created.data.id, {
      kind: 'seo',
      status: 'warn',
      score: 61,
      findings: { missingKeywords: ['ai'] },
    })
    assert.equal(check.success, true)
    assert.equal(check.data.kind, 'seo')
    assert.equal(check.data.status, 'warn')
  })

  it('filters list results by state, priority, search, and platforms', async () => {
    await contentBoardService.create(OWNER, BUSINESS, { title: 'Filter Alpha', priority: 2, platforms: ['x'] })
    await contentBoardService.create(OWNER, BUSINESS, { title: 'Filter Beta', priority: 0, platforms: ['linkedin'] })

    const bySearch = await contentBoardService.list(OWNER, BUSINESS, { search: 'Alpha' })
    assert.equal(bySearch.success, true)
    assert.equal(bySearch.data.length, 1)
    assert.equal(bySearch.data[0].title, 'Filter Alpha')

    const byPriority = await contentBoardService.list(OWNER, BUSINESS, { priority: 2 })
    assert.equal(byPriority.data.every(item => item.priority === 2), true)

    const byPlatform = await contentBoardService.list(OWNER, BUSINESS, { platforms: ['linkedin'] })
    assert.equal(byPlatform.data.every(item => (item.platforms ?? []).includes('linkedin')), true)
  })

  it('updates card metadata including the target publish date', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Meta Card' })
    const target = new Date('2026-10-05T09:30:00.000Z')
    const updated = await contentBoardService.update(OWNER, BUSINESS, created.data.id, {
      title: 'Meta Card Renamed',
      platforms: ['x', 'linkedin'],
      priority: 2,
      scheduledAt: target,
    })
    assert.equal(updated.success, true)
    assert.equal(updated.data.title, 'Meta Card Renamed')
    assert.deepEqual(updated.data.platforms, ['x', 'linkedin'])
    assert.equal(updated.data.priority, 2)
    assert.equal(new Date(updated.data.scheduledAt).toISOString(), target.toISOString())

    const cleared = await contentBoardService.update(OWNER, BUSINESS, created.data.id, { scheduledAt: null })
    assert.equal(cleared.success, true)
    assert.equal(cleared.data.scheduledAt, null)
  })
})
