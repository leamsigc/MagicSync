import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

// T04 — content board service: §6.1 transitions, agent limits, artifact gates.
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
  await walk(created.data.id, ['researching', 'research_ready', 'drafting', 'review_required'])
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

describe('content board (T04)', () => {
  it('walks agent-allowed transitions up to review_required and blocks agent approval', async () => {
    const itemId = await makeReviewRequired()
    const approval = await contentBoardService.move(OWNER, BUSINESS, itemId, 'approved', { actorKind: 'agent' })
    assert.equal(approval.success, false)
    assert.equal(approval.code, 'HUMAN_ACTION_REQUIRED')
  })

  it('only a human-approved artifact unlocks approved', async () => {
    const itemId = await makeReviewRequired()
    const early = await contentBoardService.move(OWNER, BUSINESS, itemId, 'approved', { actorKind: 'user' })
    assert.equal(early.success, false)
    assert.equal(early.code, 'ARTIFACT_REQUIRED')

    await attachApprovedArtifact(itemId)
    const human = await contentBoardService.move(OWNER, BUSINESS, itemId, 'approved', { actorKind: 'user' })
    assert.equal(human.success, true)
  })

  it('rejects invalid transitions and foreign business access', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Card B' })
    const invalid = await contentBoardService.move(OWNER, BUSINESS, created.data.id, 'published', { actorKind: 'user' })
    assert.equal(invalid.success, false)
    assert.equal(invalid.code, 'INVALID_TRANSITION')

    const foreign = await contentBoardService.move(OUTSIDER, BUSINESS, created.data.id, 'researching', { actorKind: 'agent' })
    assert.equal(foreign.success, false)
    assert.equal(foreign.code, 'NOT_FOUND')
  })

  it('requires an approved artifact before ready and scheduled', async () => {
    const itemId = await makeReviewRequired()
    await attachApprovedArtifact(itemId)
    await contentBoardService.move(OWNER, BUSINESS, itemId, 'approved', { actorKind: 'user' })
    await contentBoardService.move(OWNER, BUSINESS, itemId, 'materializing', { actorKind: 'user' })

    const ready = await contentBoardService.move(OWNER, BUSINESS, itemId, 'ready', { actorKind: 'user' })
    assert.equal(ready.success, true)

    const scheduled = await contentBoardService.move(OWNER, BUSINESS, itemId, 'scheduled', { actorKind: 'user' })
    assert.equal(scheduled.success, true)
  })

  it('appends audit events for create and every move', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Card Events' })
    await contentBoardService.move(OWNER, BUSINESS, created.data.id, 'researching', { actorKind: 'agent' })
    const events = await contentBoardService.listEvents(OWNER, BUSINESS, created.data.id)
    assert.equal(events.success, true)
    assert.deepEqual(events.data.map(event => event.event), ['created', 'state_changed'])
    assert.equal(events.data[1].fromState, 'idea')
    assert.equal(events.data[1].toState, 'researching')
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
})
