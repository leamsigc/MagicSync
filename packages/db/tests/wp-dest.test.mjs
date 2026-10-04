import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser } from './setup.mjs'

let svc
let biz
let userId = 'wp2-user'

before(async () => {
  const init = await initTestDb()
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const dest = await import('#layers/BaseDB/server/services/destination.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...dest, ...profile }
  await insertUser(init.db, { id: userId, email: 'wp2@test.local' })
  const res = await svc.businessProfileService.create(userId, { name: 'WP2 Biz' })
  biz = res.data
})

describe('dest wp', () => {
  it('prepares wordpress via destination', async () => {
    const res = await svc.destinationService.prepareWordpressArticle(userId, {
      businessId: biz.id,
      title: 'Clean Post',
      slug: 'clean-post',
      content: 'This is a clean post about social media automation for developers.',
      excerpt: '',
      category: '',
      tags: [],
      featuredImage: '',
      status: 'draft',
      language: 'en'
    })
    console.log(res)
    assert.equal(res.success, true)
  })
})
