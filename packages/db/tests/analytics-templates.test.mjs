import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

// T100 — authoritative analytics + templates over real SQLite.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/analytics-templates.test.mjs

const OWNER = 'ana-owner'
const OUTSIDER = 'ana-outsider'

let db
let schema
let cleanup
let svc

async function makeBusiness(userId, name = 'Ana Co') {
  const res = await svc.businessProfileService.create(userId, { name })
  assert.equal(res.success, true)
  return res.data
}

async function makePost(ownerId, businessId, content) {
  const accounts = await db.select({ id: schema.socialMediaAccounts.id })
    .from(schema.socialMediaAccounts)
    .where(eq(schema.socialMediaAccounts.businessId, businessId))
  const res = await svc.postService.create(ownerId, {
    businessId,
    content,
    status: 'draft',
    scheduledAt: new Date(),
    targetPlatforms: accounts.map(row => row.id),
    mediaAssets: [],
    comment: [],
  })
  assert.equal(res.success, true, `post create failed: ${res.error}`)
  return res.data
}

async function addSnapshots(postId, accountId, snapshots) {
  for (const [index, metrics] of snapshots.entries()) {
    await db.insert(schema.postMetrics).values({
      id: crypto.randomUUID(),
      postId,
      socialAccountId: accountId,
      platform: 'twitter',
      metrics: JSON.stringify(metrics),
      collectedAt: new Date(Date.now() - (snapshots.length - index) * 3600000),
    })
  }
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

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'ana-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'ana-outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const analytics = await import('#layers/BaseDB/server/services/analytics.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  const posts = await import('#layers/BaseDB/server/services/post.service.ts')
  svc = { ...analytics, ...profile, ...posts }
})

after(() => cleanup())

describe('analytics service (T100)', () => {
  it('computes engagement and virality purely', () => {
    assert.equal(svc.engagementRateOf({}), null)
    assert.equal(svc.engagementRateOf({ likes: 10, reach: 100 }), 10)
    assert.equal(svc.viralityScoreOf({}), null)
    assert.ok((svc.viralityScoreOf({ likes: 50, reach: 100, views: 10000 }) ?? 0) > 0)
    const structure = svc.postStructure('Did you know?\nSecond line #tag')
    assert.equal(structure.hookStyle, 'question')
    assert.equal(structure.hashtagCount, 1)
  })

  it('ranks by the latest snapshot, never summed cumulatives', async () => {
    const biz = await makeBusiness(OWNER)
    const account = await connectAccount(OWNER, biz.id)
    const winner = await makePost(OWNER, biz.id, 'Did we win? Yes!')
    const loser = await makePost(OWNER, biz.id, 'Just a note')
    // Winner: latest snapshot strong, even though the SUM of loser snapshots is bigger.
    await addSnapshots(winner.id, account.id, [
      { likes: 1, reach: 100 },
      { likes: 40, reach: 100 },
    ])
    await addSnapshots(loser.id, account.id, [
      { likes: 30, reach: 1000 },
      { likes: 31, reach: 1000 },
      { likes: 32, reach: 1000 },
    ])
    const res = await svc.analyticsService.getBestPosts(OWNER, biz.id, { days: 30 })
    assert.equal(res.success, true)
    assert.equal(res.data.posts[0].postId, winner.id)
    assert.equal(res.data.posts[0].metrics.engagementRate, 40)
    assert.equal(res.data.version, 'analytics/v1')
  })

  it('explains performance and warns on sparse data', async () => {
    const biz = await makeBusiness(OWNER)
    await connectAccount(OWNER, biz.id)
    const post = await makePost(OWNER, biz.id, 'Hello world?\nSecond line #tag')
    const res = await svc.analyticsService.getPostPerformance(OWNER, biz.id, post.id)
    assert.equal(res.success, true)
    assert.match(res.data.explanation, /question/)
    assert.ok(res.data.warnings.length > 0)
    const missing = await svc.analyticsService.getPostPerformance(OWNER, biz.id, 'nope')
    assert.equal(missing.code, 'NOT_FOUND')
    const foreign = await svc.analyticsService.getBestPosts(OUTSIDER, biz.id, {})
    assert.equal(foreign.success, false)
  })

  it('scores virality without fabricating zeros', async () => {
    const biz = await makeBusiness(OWNER)
    await connectAccount(OWNER, biz.id)
    const post = await makePost(OWNER, biz.id, 'Draft words here, long enough to count #x')
    const unscored = await svc.analyticsService.scoreVirality(OWNER, biz.id, { postId: post.id })
    assert.equal(unscored.data.score, null)
    const heuristic = await svc.analyticsService.scoreVirality(OWNER, biz.id, { content: 'Draft words here, long enough to count #x' })
    assert.equal(heuristic.data.score, 35)
  })

  it('destructures winners into persistent templates and applies them', async () => {
    const biz = await makeBusiness(OWNER)
    const account = await connectAccount(OWNER, biz.id)
    const post = await makePost(OWNER, biz.id, 'Did you know?\nOur method works. #growth')
    await addSnapshots(post.id, account.id, [{ likes: 25, reach: 100 }])
    const deconstructed = await svc.analyticsService.destructurePost(OWNER, biz.id, post.id)
    assert.equal(deconstructed.data.sourcePostId, post.id)
    assert.equal(deconstructed.data.hook.style, 'question')
    const created = await svc.analyticsService.createTemplate(OWNER, {
      businessId: biz.id,
      sourcePostId: post.id,
      name: 'Question hook',
      hookStyle: deconstructed.data.hook.style,
      structure: deconstructed.data.structure,
      bodyBlocks: ['{theme} works because proof.'],
      ctaStyle: 'question',
      toneNotes: 'direct',
    })
    assert.equal(created.success, true)
    const listed = await svc.analyticsService.listTemplates(OWNER, biz.id)
    assert.ok(listed.data.some(row => row.id === created.data.id))
    const applied = await svc.analyticsService.applyTemplate(OWNER, biz.id, created.data.id, 'Morning routines')
    assert.ok(applied.data.caption.includes('Morning routines'))
    assert.ok(applied.data.artifactId)
    const archived = await svc.analyticsService.archiveTemplate(OWNER, created.data.id, biz.id)
    assert.equal(archived.data.status, 'archived')
  })
})
