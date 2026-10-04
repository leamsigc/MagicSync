import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T12 approval gates through Flue (PRD §11): consequential capabilities never
 * execute without an explicit approval transition — from routes, MCP-shaped
 * callers, or jobs, because the gate lives in `runCapability`.
 */

const OWNER = 'approval-owner'
const BUSINESS = 'approval-business'
const OTHER_BUSINESS = 'approval-other'

let cleanupDb
let db
let schema
let runCapability
let approvals
let contentBoardService
let contentArtifactService

const completeNever = async () => { throw new Error('delivery.schedule performs no model calls') }

function baseCtx(overrides = {}) {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    complete: completeNever,
    systemContext: '',
    ...overrides,
  }
}

function futureIso() {
  return new Date(Date.now() + 86_400_000).toISOString()
}

async function makeApprovedArtifact() {
  const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Approval card', platforms: ['twitter'] })
  const itemId = created.data.id
  for (const state of ['drafting', 'review_required']) {
    await contentBoardService.move(OWNER, BUSINESS, itemId, state, { actorKind: 'agent' })
  }
  const submitted = await contentArtifactService.submitArtifact(OWNER, {
    businessId: BUSINESS,
    kind: 'social_post',
    outputKind: 'social_post_draft',
    output: {
      outputKind: 'social_post_draft',
      caption: 'Ship it.',
      platformVariants: { twitter: { caption: 'Ship it.', hashtags: [] } },
      slideCopy: [],
      cta: '',
      claims: [],
      sources: [],
    },
  })
  await contentArtifactService.reviewArtifact(OWNER, submitted.data.id, BUSINESS, { decision: 'approved', feedback: '', version: 1 })
  await db.update(schema.contentItems).set({ artifactId: submitted.data.id }).where(eq(schema.contentItems.id, itemId))
  await contentBoardService.move(OWNER, BUSINESS, itemId, 'scheduled', { actorKind: 'user' })
  return submitted.data.id
}

async function postCount() {
  return (await db.select().from(schema.posts)).length
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanupDb = init.cleanup
  await insertUser(db, { id: OWNER, email: 'approval@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Approval Co' })
  await insertBusiness(db, { id: OTHER_BUSINESS, userId: OWNER, name: 'Other Co' })
  const index = await import('../server/capabilities/index.ts')
  runCapability = index.runCapability
  approvals = await import('../server/flue/approvals.ts')
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ contentArtifactService } = await import('#layers/BaseDB/server/services/content-artifact.service.ts'))
})

after(() => cleanupDb())

describe('consequential capability gate (T12)', () => {
  it('blocks unapproved schedule attempts with no side effect', async () => {
    const artifactId = await makeApprovedArtifact()
    const events = []
    const before = await postCount()
    const outcome = await runCapability('delivery.schedule', {
      artifactId,
      scheduledAt: futureIso(),
      targetAccountIds: [],
    }, baseCtx({ onEvent: event => events.push(event) }))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'APPROVAL_REQUIRED')
    assert.equal(await postCount(), before, 'blocked runs create nothing')
    const required = events.find(event => event.type === 'approval.required')
    assert.ok(required, 'approval footer event emitted')
    assert.deepEqual(required.actions.map(action => action.id), ['approve', 'cancel'])
  })

  it('blocks MCP/job-shaped callers without a request logger just as strictly', async () => {
    const outcome = await runCapability('delivery.schedule', {
      artifactId: 'artifact-mcp',
      scheduledAt: futureIso(),
    }, { userId: OWNER, businessId: BUSINESS, complete: completeNever, systemContext: '' })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'APPROVAL_REQUIRED')
  })

  it('executes after request → approve, and stays blocked after cancel', async () => {
    const artifactId = await makeApprovedArtifact()
    const requested = await approvals.requestCapabilityApproval(OWNER, BUSINESS, 'delivery.schedule', 'schedule-post', 'Schedule the approved post')
    assert.equal(requested.success, true)
    const approved = await approvals.decideCapabilityApproval(OWNER, requested.data.goalRunId, true)
    assert.equal(approved.status, 'completed')

    const granted = await runCapability('delivery.schedule', {
      artifactId,
      scheduledAt: futureIso(),
      targetAccountIds: [],
    }, baseCtx({ approval: requested.data }))
    assert.notEqual(granted.code, 'APPROVAL_REQUIRED', 'explicit approval unblocks execution')

    const requested2 = await approvals.requestCapabilityApproval(OWNER, BUSINESS, 'delivery.schedule', 'schedule-post', 'Schedule again')
    assert.equal(requested2.success, true)
    const cancelled = await approvals.decideCapabilityApproval(OWNER, requested2.data.goalRunId, false)
    assert.equal(cancelled.status, 'cancelled')
    const revoked = await runCapability('delivery.schedule', {
      artifactId,
      scheduledAt: futureIso(),
      targetAccountIds: [],
    }, baseCtx({ approval: requested2.data }))
    assert.equal(revoked.ok, false)
    assert.equal(revoked.code, 'APPROVAL_REQUIRED', 'cancelled grants stay blocked')
  })

  it('rejects grants from another business', async () => {
    const requested = await approvals.requestCapabilityApproval(OWNER, OTHER_BUSINESS, 'delivery.schedule', 'schedule-post', 'Other business')
    assert.equal(requested.success, true)
    await approvals.decideCapabilityApproval(OWNER, requested.data.goalRunId, true)
    const outcome = await runCapability('delivery.schedule', {
      artifactId: 'artifact-x',
      scheduledAt: futureIso(),
    }, baseCtx({ approval: requested.data }))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'APPROVAL_REQUIRED', 'tenant mismatch never grants')
  })
})
