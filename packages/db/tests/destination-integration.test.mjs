import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser } from './setup.mjs'

const OWNER = 'dest-owner'
const OUTSIDER = 'dest-outsider'

let db
let schema
let cleanup
let svc
let realFetch

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

async function makeBusiness(userId) {
  const res = await svc.businessProfileService.create(userId, { name: 'Dest Biz' })
  assert.equal(res.success, true)
  return res.data
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  realFetch = globalThis.fetch
  await insertUser(db, { id: OWNER, email: 'dest-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'dest-outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const publishing = await import('#layers/BaseDB/server/services/publishing.service.ts')
  const artifacts = await import('#layers/BaseDB/server/services/content-artifact.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  const destination = await import('#layers/BaseDB/server/services/destination.service.ts')
  svc = { ...publishing, ...artifacts, ...profile, ...destination }
})

after(() => {
  globalThis.fetch = realFetch
  return cleanup()
})

describe('destination adapter', () => {
  it('blocks PII in github articles', async () => {
    const biz = await makeBusiness(OWNER)
    await svc.publishingService.createConnection(OWNER, {
      businessId: biz.id, provider: 'github', name: 'Docs', config: { repo: 'acme/docs', branch: 'main', dir: 'posts' }, secret: 'ghp-test',
    })
    // Stub inspection to avoid live GitHub fetch: mock githubInspectService.inspect
    const { githubInspectService } = await import('#layers/BaseDB/server/services/github-inspect.service.ts')
    const orig = githubInspectService.inspect
    const origCheck = githubInspectService.checkExistingFile
    githubInspectService.inspect = async () => ({ success: true, data: { repository: 'acme/docs', branch: 'main', framework: 'nuxt', contentSystem: 'nuxt-content', contentDir: 'content', blogDir: 'content/en/blogs', language: { type: 'prefix', pattern: 'content/{lang}/...', languages: ['en', 'de'], defaultLanguage: 'en' }, template: { path: 'content/en/blogs/example/index.md', frontmatter: { fields: ['title'], required: ['title'], optional: [], example: { title: 'Example' }, rawExample: '' }, bodySnippet: '', filenameConvention: 'folder-index' }, frontmatter: { fields: ['title'], required: ['title'], optional: [], example: {}, rawExample: '' }, sampleFiles: [], workflows: [], detectedFiles: [] } })
    githubInspectService.checkExistingFile = async () => ({ success: true, data: { exists: false } })
    const res = await svc.destinationService.prepareGithubArticle(OWNER, {
      businessId: biz.id, title: 'Hello', brief: 'Contact me at test@example.com for info', language: 'en', slug: 'hello', repository: 'acme/docs',
    })
    assert.equal(res.success, false)
    assert.equal(res.code, 'PII_DETECTED')
    githubInspectService.inspect = orig
    githubInspectService.checkExistingFile = origCheck
  })

  it('prevents approval bypass', async () => {
    const biz = await makeBusiness(OWNER)
    const conn = await svc.publishingService.createConnection(OWNER, {
      businessId: biz.id, provider: 'github', name: 'Docs2', config: { repo: 'acme/docs2', branch: 'main' }, secret: 'ghp-test',
    })
    const artifact = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'github_article', outputKind: 'github_article',
      output: { outputKind: 'github_article', title: 'T', description: 'D', slug: 't', language: 'en', targetPath: 'content/en/blogs/t/index.md', repository: 'acme/docs2', branch: 'main', frontmatter: {}, markdown: '# T\nBody', rawMarkdown: 'Body' },
    })
    // Do NOT approve
    const job = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: conn.data.id, artifactId: artifact.data.id, artifactVersion: 1,
    })
    assert.equal(job.success, false)
    assert.match(job.error ?? '', /approval/i)
  })

  it('publishes github_article with custom target path and verifies language mapping de', async () => {
    const biz = await makeBusiness(OWNER)
    const conn = await svc.publishingService.createConnection(OWNER, {
      businessId: biz.id, provider: 'github', name: 'Docs3', config: { repo: 'acme/docs', branch: 'main', dir: 'content' }, secret: 'ghp-test',
    })
    // Create approved github_article for German
    const submitted = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: biz.id, kind: 'github_article', outputKind: 'github_article',
      output: { outputKind: 'github_article', title: 'German Post', description: 'Desc', slug: 'german-post', language: 'de', targetPath: 'content/de/blogs/german-post/index.md', repository: 'acme/docs', branch: 'main', frontmatter: { title: 'German Post' }, markdown: '---\ntitle: "German Post"\n---\nBody', rawMarkdown: 'Body' },
    })
    await svc.contentArtifactService.reviewArtifact(OWNER, submitted.data.id, biz.id, { decision: 'approved', feedback: '', version: 1 })
    const created = await svc.publishingService.createJob(OWNER, {
      businessId: biz.id, connectionId: conn.data.id, artifactId: submitted.data.id, artifactVersion: 1,
    })
    assert.equal(created.success, true)
    stubFetch([
      ['GET https://api.github.com/repos/acme/docs/contents/', { status: 404, body: {} }],
      ['PUT https://api.github.com/repos/acme/docs/contents/', { status: 201, body: { content: { sha: 'sha-de' } } }],
    ])
    const executed = await svc.publishingService.executeJob(OWNER, created.data.job.id)
    assert.equal(executed.success, true)
    assert.equal(executed.data.status, 'succeeded')
  })

  it('rejects wrong business access', async () => {
    const bizOwner = await makeBusiness(OWNER)
    const conn = await svc.publishingService.createConnection(OWNER, {
      businessId: bizOwner.id, provider: 'github', name: 'DocsSec', config: { repo: 'acme/sec', branch: 'main' }, secret: 'tok',
    })
    const bizOutsider = await makeBusiness(OUTSIDER)
    const artifact = await svc.contentArtifactService.submitArtifact(OWNER, {
      businessId: bizOwner.id, kind: 'github_article', outputKind: 'github_article',
      output: { outputKind: 'github_article', title: 'T', description: 'D', slug: 't', language: 'en', targetPath: 'content/t.md', repository: 'acme/sec', branch: 'main', frontmatter: {}, markdown: '# T', rawMarkdown: '' },
    })
    await svc.contentArtifactService.reviewArtifact(OWNER, artifact.data.id, bizOwner.id, { decision: 'approved', feedback: '', version: 1 })
    const job = await svc.publishingService.createJob(OUTSIDER, {
      businessId: bizOwner.id, connectionId: conn.data.id, artifactId: artifact.data.id, artifactVersion: 1,
    })
    assert.equal(job.success, false)
    assert.equal(job.code, 'NOT_FOUND')
  })
})
