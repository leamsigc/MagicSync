import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

// T70/T80 — content artifacts + approval + materialization over real SQLite.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/content-artifacts.test.mjs

const OWNER = 'art-owner'
const OUTSIDER = 'art-outsider'

let db
let schema
let cleanup
let svc

async function makeBusiness(userId, name = 'Art Co') {
  const res = await svc.businessProfileService.create(userId, { name })
  assert.equal(res.success, true)
  return res.data
}

async function connectAccount(ownerId, businessId) {
  const [row] = await db.insert(schema.socialMediaAccounts).values({
    id: crypto.randomUUID(),
    userId: ownerId,
    businessId,
    platform: 'twitter',
    accountId: `acct-${crypto.randomUUID()}`,
    accountName: 'Test Account',
    accessToken: 'test-token',
  }).returning()
  return row
}

function draftOutput(overrides = {}) {
  return {
    outputKind: 'social_post_draft',
    caption: 'Hello world',
    platformVariants: {},
    slideCopy: [],
    cta: '',
    claims: [],
    sources: [],
    ...overrides,
  }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'art-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'art-outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const artifacts = await import('#layers/BaseDB/server/services/content-artifact.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...artifacts, ...profile }
})

after(() => cleanup())

describe('content artifacts (T70/T80)', () => {
  it('submits typed artifacts for review', async () => {
    const biz = await makeBusiness(OWNER)
    const res = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    assert.equal(res.success, true)
    assert.equal(res.data.status, 'review_required')
    assert.equal(res.data.version, 1)
    const bad = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'telepathy', output: {},
    })
    assert.equal(bad.success, false)
  })

  it('edits create new versions, snapshot history, and reject stale edits', async () => {
    const biz = await makeBusiness(OWNER)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    const reviewed = await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: '', version: 1,
    })
    assert.equal(reviewed.data.artifact.status, 'approved')
    const edited = await svc.contentArtifactService.editArtifact(OWNER, created.data.id, biz.id, {
      version: 1,
      output: draftOutput({ caption: 'Hello edited' }),
    })
    assert.equal(edited.data.version, 2)
    assert.equal(edited.data.status, 'review_required')
    assert.equal(edited.data.revisions.length, 1)
    assert.equal(edited.data.revisions[0].version, 1)
    assert.equal(JSON.parse(edited.data.revisions[0].output).caption, 'Hello world')
    const stale = await svc.contentArtifactService.editArtifact(OWNER, created.data.id, biz.id, {
      version: 1,
      output: draftOutput({ caption: 'Racing edit' }),
    })
    assert.equal(stale.success, false)
    assert.equal(stale.code, 'VERSION_CONFLICT')
  })

  it('rejects stale-version reviews', async () => {
    const biz = await makeBusiness(OWNER)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    const stale = await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: '', version: 99,
    })
    assert.equal(stale.success, false)
  })

  it('materializes approved posts idempotently, never unapproved ones', async () => {
    const biz = await makeBusiness(OWNER)
    await connectAccount(OWNER, biz.id)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    const early = await svc.contentArtifactService.materializeArtifact(OWNER, created.data.id, biz.id)
    assert.equal(early.success, false)
    await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: '', version: 1,
    })
    const first = await svc.contentArtifactService.materializeArtifact(OWNER, created.data.id, biz.id)
    assert.equal(first.success, true)
    assert.equal(first.data.duplicate, false)
    assert.ok(first.data.postId)
    const second = await svc.contentArtifactService.materializeArtifact(OWNER, created.data.id, biz.id)
    assert.equal(second.data.duplicate, true)
    assert.equal(second.data.postId, first.data.postId)
  })

  it('schedules approved artifacts into pending posts', async () => {
    const biz = await makeBusiness(OWNER)
    await connectAccount(OWNER, biz.id)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: '', version: 1,
    })
    const future = new Date(Date.now() + 86400000)
    const scheduled = await svc.contentArtifactService.scheduleArtifact(OWNER, created.data.id, biz.id, future)
    assert.equal(scheduled.success, true)
    assert.equal(scheduled.data.artifact.status, 'scheduled')
  })

  it('schedules only explicit target accounts and rejects foreign ones', async () => {
    const biz = await makeBusiness(OWNER)
    const accountA = await connectAccount(OWNER, biz.id)
    const accountB = await connectAccount(OWNER, biz.id)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: '', version: 1,
    })
    const future = new Date(Date.now() + 86400000)
    const scheduled = await svc.contentArtifactService.scheduleArtifact(OWNER, created.data.id, biz.id, future, undefined, [accountA.id])
    assert.equal(scheduled.success, true, scheduled.error ?? '')
    const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, scheduled.data.postId))
    assert.deepEqual(JSON.parse(post.targetPlatforms), [accountA.id])
    const foreign = await svc.contentArtifactService.scheduleArtifact(OWNER, created.data.id, biz.id, future, undefined, ['not-an-account'])
    assert.equal(foreign.success, false)
    void accountB
  })

  for (const targetAccountIds of [[], ['not-an-account']]) {
    it(`rejects explicit targets ${JSON.stringify(targetAccountIds)} before materialization`, async () => {
      const biz = await makeBusiness(OWNER)
      await connectAccount(OWNER, biz.id)
      const created = await svc.contentArtifactService.submitArtifact(OWNER, {
        businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
      })
      await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
        decision: 'approved', feedback: '', version: 1,
      })
      const before = await svc.contentArtifactService.getArtifact(OWNER, created.data.id, biz.id)
      const result = await svc.contentArtifactService.scheduleArtifact(
        OWNER, created.data.id, biz.id, new Date(Date.now() + 86400000), undefined, targetAccountIds,
      )
      const posts = await db.select().from(schema.posts).where(eq(schema.posts.businessId, biz.id))
      assert.equal(posts.length, 0)
      assert.equal(result.success, false)
      assert.equal(result.code, 'VALIDATION_ERROR')
      const after = await svc.contentArtifactService.getArtifact(OWNER, created.data.id, biz.id)
      assert.deepEqual(after.data, before.data)
    })
  }

  it('loses no approval record when a stale review races the guarded update', async () => {
    const biz = await makeBusiness(OWNER)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    await db.update(schema.contentArtifacts)
      .set({ version: 2 })
      .where(eq(schema.contentArtifacts.id, created.data.id))
    const stale = await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: 'raced', version: 1,
    })
    assert.equal(stale.success, false)
    assert.equal(stale.code, 'VERSION_CONFLICT')
    const records = await db.select().from(schema.approvalRecords)
      .where(eq(schema.approvalRecords.artifactId, created.data.id))
    assert.equal(records.length, 0)
    const [row] = await db.select().from(schema.contentArtifacts)
      .where(eq(schema.contentArtifacts.id, created.data.id))
    assert.equal(row.status, 'review_required')
    assert.equal(row.version, 2)
  })

  it('rejects edits after the artifact is scheduled', async () => {
    const biz = await makeBusiness(OWNER)
    await connectAccount(OWNER, biz.id)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: '', version: 1,
    })
    const scheduled = await svc.contentArtifactService.scheduleArtifact(
      OWNER, created.data.id, biz.id, new Date(Date.now() + 86400000), undefined, [],
    )
    assert.equal(scheduled.success, false)
    const materialized = await svc.contentArtifactService.materializeArtifact(OWNER, created.data.id, biz.id)
    assert.equal(materialized.success, true)
    const scheduledNow = await svc.contentArtifactService.scheduleArtifact(
      OWNER, created.data.id, biz.id, new Date(Date.now() + 86400000),
    )
    assert.equal(scheduledNow.success, true)
    const edited = await svc.contentArtifactService.editArtifact(OWNER, created.data.id, biz.id, {
      version: scheduledNow.data.artifact.version,
      output: draftOutput({ caption: 'Edit after schedule' }),
    })
    assert.equal(edited.success, false)
    assert.equal(edited.code, 'VALIDATION_ERROR')
  })

  it('scopes artifacts by business and records approval history', async () => {
    const biz = await makeBusiness(OWNER)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    const foreign = await svc.contentArtifactService.getArtifact(OUTSIDER, created.data.id, biz.id)
    assert.equal(foreign.success, false)
    await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'changes_requested', feedback: 'punchier', version: 1,
    })
    const history = await svc.contentArtifactService.listApprovals(OWNER, { businessId: biz.id })
    assert.ok(history.data.some(row => row.artifactId === created.data.id && row.feedback === 'punchier'))
    const listed = await svc.contentArtifactService.listArtifacts(OWNER, { businessId: biz.id })
    assert.ok(listed.data.some(row => row.id === created.data.id))
  })
})
