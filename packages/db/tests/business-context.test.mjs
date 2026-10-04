import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser } from './setup.mjs'

// T20.1 — BusinessContextResolver behavior over real SQLite.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/business-context.test.mjs

const OWNER = 'ctx-owner'
const OUTSIDER = 'ctx-outsider'

let db
let schema
let cleanup
let svc

async function makeBusiness(userId, attrs = {}) {
  const res = await svc.businessProfileService.create(userId, { name: 'Ctx Co', ...attrs })
  assert.equal(res.success, true, `business create failed: ${res.error}`)
  return res.data
}

async function publishPlaybook(userId, businessId, playbook) {
  const saved = await svc.brandPlaybookService.saveDraft(userId, businessId, playbook)
  assert.equal(saved.success, true)
  const published = await svc.brandPlaybookService.publish(userId, businessId, saved.data.id, userId)
  assert.equal(published.success, true)
  return published.data.edition
}

function basePlaybook(overrides = {}) {
  return {
    version: 1,
    businessName: 'Ctx Co',
    identity: { name: 'Ctx Co', website: '', industry: '', location: '' },
    audience: { primary: 'Owners', roles: [], problem: '', outcome: '' },
    voice: { tone: 'Bold', bannedPhrases: [], influences: [], examples: [] },
    positioning: { audience: '', problem: '', differentiator: 'We deliver', alternatives: [], costOfInaction: '' },
    offers: [],
    hooks: [],
    competitors: [],
    testimonials: [],
    proof: { caseStudies: [], permission: '' },
    keywords: { primary: [], secondary: [] },
    author: '',
    ctaLinks: [],
    conversion: { ctaRules: '' },
    imageStyle: '',
    visualStyle: { colors: [], fonts: [], restrictions: [] },
    sources: [{ label: 'site', kind: 'url', uri: 'https://ctx.test', verified: true, detail: '' }],
    safety: { neverSay: [], verifyBeforeClaim: [] },
    completion: { filledGroups: [], missingFields: [], ready: false, updatedAt: null },
    metadata: { schemaVersion: 2 },
    ...overrides,
  }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'ctx-owner@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'ctx-outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({ getFullOrganization: async () => ({ members: [] }) })
  const resolver = await import('#layers/BaseDB/server/services/business-context-resolver.service.ts')
  const playbook = await import('#layers/BaseDB/server/services/brand-playbook.service.ts')
  const corpus = await import('#layers/BaseDB/server/services/business-corpus.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...resolver, ...playbook, ...corpus, ...profile }
})

after(() => cleanup())

describe('BusinessContextResolver (T20.1)', () => {
  it('stays disabled without an explicit opt-in', async () => {
    const biz = await makeBusiness(OWNER)
    const res = await svc.businessContextResolver.resolve(OWNER, { businessId: biz.id })
    assert.equal(res.success, true)
    assert.equal(res.data.enabled, false)
    assert.equal(res.data.prompt, '')
    assert.equal(res.data.editionId, null)
  })

  it('rejects invalid options', async () => {
    const res = await svc.businessContextResolver.resolve(OWNER, { useBusinessContext: true, businessId: 'x', contextBudgetTokens: -5 })
    assert.equal(res.success, false)
    assert.equal(res.code, 'VALIDATION_ERROR')
  })

  it('requires a selected business when enabled', async () => {
    const res = await svc.businessContextResolver.resolve(OWNER, { useBusinessContext: true })
    assert.equal(res.success, false)
    assert.equal(res.code, 'CONTEXT_NO_BUSINESS')
  })

  it('hides existence from outsiders', async () => {
    const biz = await makeBusiness(OWNER)
    const res = await svc.businessContextResolver.resolve(OUTSIDER, { businessId: biz.id, useBusinessContext: true })
    assert.equal(res.success, false)
    assert.equal(res.code, 'NOT_FOUND')
  })

  it('blocks branded calls without a current edition', async () => {
    const biz = await makeBusiness(OWNER)
    const res = await svc.businessContextResolver.resolve(OWNER, { businessId: biz.id, useBusinessContext: true })
    assert.equal(res.success, false)
    assert.equal(res.code, 'BRAND_CONTEXT_REQUIRED')
  })

  it('resolves current-edition context with framing and sources', async () => {
    const biz = await makeBusiness(OWNER)
    const edition = await publishPlaybook(OWNER, biz.id, basePlaybook())
    const res = await svc.businessContextResolver.resolve(OWNER, { businessId: biz.id, useBusinessContext: true })
    assert.equal(res.success, true)
    assert.equal(res.data.enabled, true)
    assert.equal(res.data.editionId, edition.id)
    assert.match(res.data.prompt, /UNTRUSTED business data/)
    assert.match(res.data.prompt, new RegExp(edition.id))
    assert.deepEqual(res.data.sources, [{ label: 'site', kind: 'url', verified: true }])
    assert.ok(res.data.tokenEstimate > 0)
    assert.ok(res.data.sections.includes('voice_guide'))
    assert.ok(res.data.sections.includes('positioning'))
  })

  it('truncates deterministically with warnings', async () => {
    const biz = await makeBusiness(OWNER)
    await publishPlaybook(OWNER, biz.id, basePlaybook())
    const opts = { businessId: biz.id, useBusinessContext: true, contextBudgetTokens: 8 }
    const first = await svc.businessContextResolver.resolve(OWNER, opts)
    const second = await svc.businessContextResolver.resolve(OWNER, opts)
    assert.equal(first.data.truncated, true)
    assert.ok(first.data.warnings.length > 0)
    assert.equal(first.data.prompt, second.data.prompt)
  })

  it('redacts credential-like values', async () => {
    const biz = await makeBusiness(OWNER)
    await publishPlaybook(OWNER, biz.id, basePlaybook())
    await svc.businessCorpusService.upsertSection(OWNER, {
      businessId: biz.id,
      section: 'testimonials',
      content: 'Key sk-live-abcdef123 and api_key: hunter2 work here',
    })
    const res = await svc.businessContextResolver.resolve(OWNER, { businessId: biz.id, useBusinessContext: true })
    assert.ok(!res.data.prompt.includes('sk-live-abcdef123'))
    assert.ok(!res.data.prompt.includes('hunter2'))
    assert.ok(res.data.prompt.includes('[REDACTED]'))
  })

  it('leaves plain prose alone in the redaction helper', async () => {
    assert.equal(svc.redactSecrets('plain text'), 'plain text')
    assert.ok(svc.redactSecrets('token=abc123').includes('[REDACTED]'))
  })
})
