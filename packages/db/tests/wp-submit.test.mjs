import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser } from './setup.mjs'

let svc
let biz

before(async () => {
  const init = await initTestDb()
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const artifacts = await import('#layers/BaseDB/server/services/content-artifact.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...artifacts, ...profile }
  await insertUser(init.db, { id: 'wp-user', email: 'wp@test.local' })
  const res = await svc.businessProfileService.create('wp-user', { name: 'WP Biz' })
  assert.equal(res.success, true)
  biz = res.data
})

describe('wp submit', () => {
  it('submits wordpress_article via service', async () => {
    const res = await svc.contentArtifactService.submitArtifact('wp-user', {
      businessId: biz.id,
      kind: 'wordpress_article',
      outputKind: 'wordpress_article',
      output: {
        outputKind: 'wordpress_article',
        title: 'Clean Post',
        slug: 'clean-post',
        language: 'en',
        content: 'This is a clean post about social media automation for developers.',
        excerpt: '',
        category: '',
        tags: [],
        featuredImage: '',
        status: 'draft',
        wordpressUrl: ''
      }
    })
    console.log(res)
    assert.equal(res.success, true)
  })
})
