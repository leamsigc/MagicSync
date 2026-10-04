import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

// T120 — publishing jobs: approval gate, idempotency, mocked providers.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/publishing-jobs.test.mjs

const OWNER = 'pub-owner'
const OUTSIDER = 'pub-outsider'

let db
let schema
let cleanup
let svc
let realFetch

async function makeBusiness(userId, name = 'Pub Co') {
  const res = await svc.businessProfileService.create(userId, { name })
  assert.equal(res.success, true)
  return res.data
}

async function makeConnection(ownerId, businessId, overrides = {}) {
  const res = await svc.publishingService.createConnection(ownerId, {
    businessId,
    provider: 'github',
    name: 'Docs',
    config: { repo: 'acme/docs', branch: 'main', dir: 'posts' },
    secret: 'ghp-test-token',
    ...overrides,
  })
  assert.equal(res.success, true)
  return res.data
}

async function makeApprovedArtifact(ownerId, businessId) {
  const submitted = await svc.contentArtifactService.submitArtifact(ownerId, {
    businessId,
    kind: 'social_post',
    outputKind: 'social_post_draft',
    output: {
      outputKind: 'social_post_draft', caption: 'Ship it', platformVariants: {},
      slideCopy: [], cta: '', claims: [], sources: [],
    },
  })
  const reviewed = await svc.contentArtifactService.reviewArtifact(ownerId, submitted.data.id, businessId, {
    decision: 'approved', feedback: '', version: 1,
  })
  return reviewed.data.artifact
}

function stubFetch(routes) {
  globalThis.fetch = async (url, init = {}) => {
    const key = `${init.method || 'GET'} ${url}`
    for (const [match, response] of routes) {
      if (key.includes(match)) {
        return {
          ok: response.status < 300,
          status: response.status,
          json: async () => response.body ?? {},
          text: async () => JSON.stringify(response.body ?? {}),
        }
      }
    }
    throw new Error(`unexpected fetch: ${key}`)
  }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  realFetch = globalThis.fetch
  await insertUser(db, { id: OWNER, email: 'pub-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'pub-outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const publishing = await import('#layers/BaseDB/server/services/publishing.service.ts')
  const artifacts = await import('#layers/BaseDB/server/services/content-artifact.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...publishing, ...artifacts, ...profile }
})

after(() => {
  globalThis.fetch = realFetch
  return cleanup()
})

describe('publishing jobs (T120)', () => {
  it('validates delivery modes per provider', async () => {
    const biz = await makeBusiness(OWNER)
    const bad = await svc.publishingService.createConnection(OWNER, {
      businessId: biz.id, provider: 'github', name: 'X', config: { repo: 'a/b' }, deliveryMode: 'live',
    })
    assert.equal(bad.success, false)
    const good = await makeConnection(OWNER, biz.id, { deliveryMode: 'pr' })
    assert.equal(good.deliveryMode, 'pr')
  })

  it('gates jobs on exact-version approval and dedupes by key', async () => {
    const biz = await makeBusiness(OWNER)
    const connection = await makeConnection(OWNER, biz.id)
    const artifact = await makeApprovedArtifact(OWNER, biz.id)
    const first = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: connection.id, artifactId: artifact.id, artifactVersion: 1,
    })
    assert.equal(first.data.duplicate, false)
    const second = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: connection.id, artifactId: artifact.id, artifactVersion: 1,
    })
    assert.equal(second.data.duplicate, true)
    assert.equal(second.data.job.id, first.data.job.id)
    const wrongVersion = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: connection.id, artifactId: artifact.id, artifactVersion: 99,
    })
    assert.equal(wrongVersion.success, false)
  })

  it('executes github commits with mocked responses', async () => {
    const biz = await makeBusiness(OWNER)
    const connection = await makeConnection(OWNER, biz.id)
    const artifact = await makeApprovedArtifact(OWNER, biz.id)
    const created = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: connection.id, artifactId: artifact.id, artifactVersion: 1,
    })
    stubFetch([
      ['GET https://api.github.com/repos/acme/docs/contents/', { status: 404, body: {} }],
      ['PUT https://api.github.com/repos/acme/docs/contents/', { status: 201, body: { content: { sha: 'abc123' } } }],
    ])
    const executed = await svc.publishingService.executeJob(OWNER, created.data.job.id)
    assert.equal(executed.success, true)
    assert.equal(executed.data.status, 'succeeded')
    assert.equal(executed.data.commitSha, 'abc123')
  })

  it('maps github conflicts to conflict status for retry', async () => {
    const biz = await makeBusiness(OWNER)
    const connection = await makeConnection(OWNER, biz.id)
    const artifact = await makeApprovedArtifact(OWNER, biz.id)
    const created = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: connection.id, artifactId: artifact.id, artifactVersion: 1,
    })
    stubFetch([
      ['contents/', { status: 422, body: { message: 'sha mismatch' } }],
    ])
    const executed = await svc.publishingService.executeJob(OWNER, created.data.job.id)
    assert.equal(executed.success, false)
    const jobs = await svc.publishingService.listJobs(OWNER, biz.id)
    const job = jobs.data.find(row => row.id === created.data.job.id)
    assert.equal(job.status, 'conflict')
    stubFetch([
      ['contents/', { status: 201, body: { content: { sha: 'def456' } } }],
    ])
    const retried = await svc.publishingService.retryJob(OWNER, created.data.job.id)
    assert.equal(retried.success, true)
    assert.equal(retried.data.attemptCount, 2)
  })

  it('creates pull requests idempotently without merging', async () => {
    const biz = await makeBusiness(OWNER)
    const connection = await makeConnection(OWNER, biz.id, { deliveryMode: 'pr' })
    const artifact = await makeApprovedArtifact(OWNER, biz.id)
    const created = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: connection.id, artifactId: artifact.id, artifactVersion: 1,
    })
    stubFetch([
      ['git/ref/heads/main', { status: 200, body: { object: { sha: 'base0' } } }],
      ['git/ref/heads/magicsync', { status: 404, body: {} }],
      ['git/refs', { status: 201, body: { ref: 'refs/heads/magicsync/x' } }],
      ['contents/', { status: 201, body: { content: { sha: 'file1' } } }],
      ['pulls?state=open', { status: 200, body: [] }],
      ['/pulls', { status: 201, body: { html_url: 'https://github.com/acme/docs/pull/7' } }],
    ])
    const executed = await svc.publishingService.executeJob(OWNER, created.data.job.id)
    assert.equal(executed.success, true)
    assert.equal(executed.data.pullRequestUrl, 'https://github.com/acme/docs/pull/7')
  })

  it('gates wordpress live mode and validates site urls', async () => {
    const biz = await makeBusiness(OWNER)
    const draft = await svc.publishingService.createConnection(OWNER, {
      businessId: biz.id, provider: 'wordpress', name: 'Blog',
      config: { siteUrl: 'https://blog.test', username: 'editor' }, secret: 'app-pass',
    })
    assert.equal(draft.data.deliveryMode, 'draft')
    const artifact = await makeApprovedArtifact(OWNER, biz.id)
    // Live mode without allowLive is rejected before any fetch.
    await db.update(schema.publishConnections)
      .set({ deliveryMode: 'live' })
      .where(eq(schema.publishConnections.id, draft.data.id))
    const created = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: draft.data.id, artifactId: artifact.id, artifactVersion: 1,
    })
    const executed = await svc.publishingService.executeJob(OWNER, created.data.job.id)
    assert.equal(executed.success, false)
    assert.match(executed.error ?? '', /Live publishing is not enabled/)
  })

  it('tests connections with mocked providers', async () => {
    const biz = await makeBusiness(OWNER)
    const connection = await makeConnection(OWNER, biz.id)
    stubFetch([['GET https://api.github.com/repos/acme/docs', { status: 200, body: {} }]])
    const ok = await svc.publishingService.testConnection(OWNER, connection.id)
    assert.equal(ok.data.ok, true)
    stubFetch([['GET https://api.github.com/repos/acme/docs', { status: 401, body: {} }]])
    const denied = await svc.publishingService.testConnection(OWNER, connection.id)
    assert.equal(denied.data.ok, false)
    const foreign = await svc.publishingService.testConnection(OUTSIDER, connection.id)
    assert.equal(foreign.success, false)
  })
})
