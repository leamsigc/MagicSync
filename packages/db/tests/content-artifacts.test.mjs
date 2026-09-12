import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
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

  it('edits create new versions and invalidate approvals', async () => {
    const biz = await makeBusiness(OWNER)
    const created = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'social_post', outputKind: 'social_post_draft', output: draftOutput(),
    })
    const reviewed = await svc.contentArtifactService.reviewArtifact(OWNER, created.data.id, biz.id, {
      decision: 'approved', feedback: '', version: 1,
    })
    assert.equal(reviewed.data.artifact.status, 'approved')
    const edited = await svc.contentArtifactService.editArtifact(OWNER, created.data.id, biz.id, {
      output: draftOutput({ caption: 'Hello edited' }),
    })
    assert.equal(edited.data.version, 2)
    assert.equal(edited.data.status, 'review_required')
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
