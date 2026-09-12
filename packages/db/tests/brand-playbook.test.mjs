import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser } from './setup.mjs'

// T10.3 — Brand Playbook service/API behavior over real SQLite.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/brand-playbook.test.mjs

const OWNER = 'owner-1'
const MEMBER = 'member-1'
const OUTSIDER = 'outsider-1'

let db
let schema
let cleanup
let svc

async function makeBusiness(userId, attrs = {}) {
  const res = await svc.businessProfileService.create(userId, { name: 'Acme Co', ...attrs })
  assert.equal(res.success, true, `business create failed: ${res.error}`)
  return res.data
}

async function attachOrg(businessId, orgId = 'org-1') {
  await db.insert(schema.entityDetails).values({
    id: crypto.randomUUID(),
    entityId: businessId,
    entityType: 'business_details',
    details: { organizationId: orgId },
  })
}

function fullPlaybook(overrides = {}) {
  return {
    version: 1,
    businessName: 'Acme Co',
    identity: { name: 'Acme Co', website: 'https://acme.test', industry: 'Retail', location: 'Austin' },
    audience: { primary: 'Shop owners', roles: [], problem: 'No time', outcome: 'More sales' },
    voice: { tone: 'Friendly', bannedPhrases: [], influences: [], examples: [] },
    positioning: { audience: '', problem: 'No time', differentiator: 'We deliver', alternatives: [], costOfInaction: '' },
    offers: [{ name: 'Setup', transformation: 'Live in a day', price: '$99', availability: '', hidePrice: false }],
    hooks: ['Hook one'],
    competitors: [],
    testimonials: [{ quote: 'Great!', name: 'Sam', role: 'Owner' }],
    proof: { caseStudies: [], permission: '' },
    keywords: { primary: ['pos systems'], secondary: [] },
    author: 'Acme Team',
    ctaLinks: [{ url: 'https://acme.test/start', label: 'Start', whenToUse: 'always' }],
    conversion: { ctaRules: '' },
    imageStyle: 'Bright photos',
    visualStyle: { colors: [], fonts: [], restrictions: [] },
    sources: [],
    safety: { neverSay: ['Guaranteed #1 ranking'], verifyBeforeClaim: [] },
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
  await insertUser(db, { id: OWNER, email: 'owner@test.local' })
  await insertUser(db, { id: MEMBER, email: 'member@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({
    getFullOrganization: async () => ({ members: [{ userId: OWNER }, { userId: MEMBER }] }),
  })
  const playbook = await import('#layers/BaseDB/server/services/brand-playbook.service.ts')
  const corpus = await import('#layers/BaseDB/server/services/business-corpus.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...playbook, ...corpus, ...profile }
})

after(() => cleanup())

describe('playbook schema (T10.1)', () => {
  it('parses v1 payloads and normalizes them to v2 defaults', () => {
    const parsed = svc.BrandPlaybookSchema.safeParse({ businessName: 'Old Co', voice: { tone: 'Dry' } })
    assert.equal(parsed.success, true)
    // Raw parses may carry partial groups (.default({}) bypasses inner
    // validation); normalizePlaybook is the completion contract.
    const normalized = svc.normalizePlaybook(parsed.data)
    assert.equal(normalized.identity.name, 'Old Co')
    assert.equal(normalized.metadata.schemaVersion, 2)
    assert.deepEqual(normalized.visualStyle.colors, [])
    assert.equal(normalized.voice.tone, 'Dry')
  })

  it('normalizes legacy aliases into canonical groups', () => {
    const parsed = svc.BrandPlaybookSchema.safeParse({
      businessName: 'Old Co',
      positioning: { audience: 'Owners' },
    })
    const normalized = svc.normalizePlaybook(parsed.data)
    assert.equal(normalized.identity.name, 'Old Co')
    assert.equal(normalized.audience.primary, 'Owners')
    assert.equal(normalized.metadata.schemaVersion, 2)
  })

  it('computes completion without inventing content', () => {
    const empty = svc.normalizePlaybook(svc.BrandPlaybookSchema.parse({}))
    const done = svc.getCompletion(empty)
    assert.equal(done.ready, false)
    assert.ok(done.missingFields.length > 0)
    const full = svc.getCompletion(svc.normalizePlaybook(fullPlaybook()))
    assert.equal(full.ready, true)
    assert.deepEqual(full.missingFields, [])
  })

  it('hashes deterministically and changes with content', () => {
    const base = fullPlaybook()
    assert.equal(svc.hashPlaybook(base), svc.hashPlaybook(structuredClone(base)))
    assert.notEqual(svc.hashPlaybook(base), svc.hashPlaybook({ ...base, author: 'Other' }))
  })

  it('builds intake drafts from grouped answers', () => {
    const grouped = svc.groupIntakeAnswers([
      { group: 'voice', question: 'tone', answer: 'Bold' },
      { group: 'conversion', question: 'link', answer: 'https://acme.test/go' },
      { group: 'conversion', question: 'blank', answer: '   ' },
    ])
    assert.deepEqual(grouped.get('voice'), ['Bold'])
    const draft = svc.normalizePlaybook(svc.BrandPlaybookSchema.parse({}))
    svc.applyIntakeGroups(draft, grouped)
    assert.equal(draft.voice.tone, 'Bold')
    assert.equal(draft.ctaLinks[0].url, 'https://acme.test/go')
    assert.equal(draft.identity.website, 'https://acme.test/go')
  })

  it('projects context without placeholder fragments', () => {
    const sections = svc.projectSections(svc.normalizePlaybook(fullPlaybook()))
    assert.match(sections.positioning, /Acme Co/)
    assert.match(sections.voice_guide, /Tone: Friendly/)
    assert.match(sections.seo_keywords, /Primary: pos systems/)
    assert.ok(!sections.positioning.includes('Tone: .'))
    assert.ok(!Object.values(sections).some(text => text.includes('[audience]')))
    const keys = svc.projectKeys(svc.normalizePlaybook(fullPlaybook()))
    assert.match(keys.image_style, /Bright photos/)
    const empty = svc.projectSections(svc.normalizePlaybook(svc.BrandPlaybookSchema.parse({})))
    assert.equal(empty.seo_keywords, '')
    assert.equal(empty.voice_guide, '')
  })
})

describe('playbook editions (T10.3)', () => {
  it('publishes a draft to current', async () => {
    const biz = await makeBusiness(OWNER)
    const saved = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    assert.equal(saved.success, true)
    const published = await svc.brandPlaybookService.publish(OWNER, biz.id, saved.data.id, OWNER)
    assert.equal(published.success, true)
    assert.equal(published.data.duplicate, false)
    assert.equal(published.data.edition.status, 'current')
    const current = await svc.brandPlaybookService.getCurrent(OWNER, biz.id)
    assert.equal(current.data.id, saved.data.id)
  })

  it('archives the former current on publish', async () => {
    const biz = await makeBusiness(OWNER)
    const first = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    await svc.brandPlaybookService.publish(OWNER, biz.id, first.data.id, OWNER)
    const second = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook({ author: 'V2' }))
    await svc.brandPlaybookService.publish(OWNER, biz.id, second.data.id, OWNER)
    const editions = await svc.brandPlaybookService.listEditions(OWNER, biz.id)
    const byId = new Map(editions.data.map(e => [e.id, e.status]))
    assert.equal(byId.get(first.data.id), 'archived')
    assert.equal(byId.get(second.data.id), 'current')
  })

  it('rejects duplicate hashes without new editions', async () => {
    const biz = await makeBusiness(OWNER)
    const first = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    await svc.brandPlaybookService.publish(OWNER, biz.id, first.data.id, OWNER)
    const again = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    const republished = await svc.brandPlaybookService.publish(OWNER, biz.id, again.data.id, OWNER)
    assert.equal(republished.data.duplicate, true)
    const editions = await svc.brandPlaybookService.listEditions(OWNER, biz.id)
    assert.equal(editions.data.length, 2)
  })

  it('discards drafts but never current editions', async () => {
    const biz = await makeBusiness(OWNER)
    const draft = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    const discarded = await svc.brandPlaybookService.discard(OWNER, biz.id, draft.data.id)
    assert.equal(discarded.data.status, 'discarded')
    const missing = await svc.brandPlaybookService.discard(OWNER, biz.id, 'nope')
    assert.equal(missing.success, false)
    const draft2 = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    await svc.brandPlaybookService.publish(OWNER, biz.id, draft2.data.id, OWNER)
    const refuse = await svc.brandPlaybookService.discard(OWNER, biz.id, draft2.data.id)
    assert.equal(refuse.success, false)
    assert.equal(refuse.code, 'VALIDATION_ERROR')
  })

  it('restores archived editions as new drafts without mutating history', async () => {
    const biz = await makeBusiness(OWNER)
    const first = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook({ author: 'V1' }))
    await svc.brandPlaybookService.publish(OWNER, biz.id, first.data.id, OWNER)
    const second = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook({ author: 'V2' }))
    await svc.brandPlaybookService.publish(OWNER, biz.id, second.data.id, OWNER)
    const restored = await svc.brandPlaybookService.restoreAsDraft(OWNER, biz.id, first.data.id)
    assert.equal(restored.data.playbook.author, 'V1')
    const editions = await svc.brandPlaybookService.listEditions(OWNER, biz.id)
    const original = editions.data.find(e => e.id === first.data.id)
    assert.equal(original.status, 'archived')
    assert.equal(editions.data.length, 3)
  })

  it('projects published playbooks into corpus sections and brand keys', async () => {
    const biz = await makeBusiness(OWNER)
    const saved = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    const published = await svc.brandPlaybookService.publish(OWNER, biz.id, saved.data.id, OWNER)
    assert.ok(published.data.projection.sections > 0)
    const corpus = await svc.businessCorpusService.getCorpus(biz.id, OWNER)
    const sections = new Map(corpus.data.map(row => [row.section, row.content]))
    assert.match(sections.get('voice_guide'), /Friendly/)
    assert.match(sections.get('positioning'), /Acme Co/)
    const keys = await svc.businessCorpusService.getBrandKeys(biz.id, OWNER)
    const byKey = new Map(keys.data.map(row => [row.key, row.content]))
    assert.match(byKey.get('cta_links'), /acme\.test\/start/)
    const synced = await svc.brandPlaybookService.sync(OWNER, biz.id)
    assert.equal(synced.success, true)
  })

  it('reports blocking readiness only with a current edition', async () => {
    const biz = await makeBusiness(OWNER)
    const before = await svc.brandPlaybookService.getBlockingStatus(OWNER, biz.id)
    assert.equal(before.data.brandedReady, false)
    const saved = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    await svc.brandPlaybookService.publish(OWNER, biz.id, saved.data.id, OWNER)
    const after = await svc.brandPlaybookService.getBlockingStatus(OWNER, biz.id)
    assert.equal(after.data.brandedReady, true)
    assert.equal(after.data.editionId, saved.data.id)
  })

  it('enforces owner/member/outsider access', async () => {
    const biz = await makeBusiness(OWNER)
    await attachOrg(biz.id)
    const owned = await svc.brandPlaybookService.getCurrent(OWNER, biz.id)
    assert.equal(owned.success, true)
    const shared = await svc.brandPlaybookService.getCurrent(MEMBER, biz.id, {})
    assert.equal(shared.success, true)
    const stranger = await svc.brandPlaybookService.getCurrent(OUTSIDER, biz.id)
    assert.equal(stranger.success, false)
    assert.equal(stranger.code, 'NOT_FOUND')
  })

  it('migrates legacy entity details once and preserves corpus', async () => {
    const biz = await makeBusiness(OWNER)
    await db.insert(schema.entityDetails).values({
      id: crypto.randomUUID(),
      entityId: biz.id,
      entityType: 'business_details',
      details: {
        companyInformation: 'Family-run shop since 1998',
        brandDetails: { tone: 'Warm', audience: 'Neighbors', website: 'https://acme.test', industry: 'Retail' },
      },
    })
    const first = await svc.brandPlaybookService.migrateLegacy(OWNER, biz.id)
    assert.equal(first.data.migrated, true)
    assert.equal(first.data.duplicate, false)
    assert.equal(first.data.edition.playbook.voice.tone, 'Warm')
    assert.equal(first.data.edition.playbook.identity.website, 'https://acme.test')
    assert.ok(first.data.edition.playbook.sources.some(s => s.label === 'legacy_entity_details'))
    const second = await svc.brandPlaybookService.migrateLegacy(OWNER, biz.id)
    assert.equal(second.data.migrated, false)
    assert.equal(second.data.duplicate, true)
    assert.equal(second.data.edition.id, first.data.edition.id)
    const editions = await svc.brandPlaybookService.listEditions(OWNER, biz.id)
    assert.equal(editions.data.length, 1)
  })

  it('returns empty migration results without legacy rows', async () => {
    const biz = await makeBusiness(OWNER)
    const res = await svc.brandPlaybookService.migrateLegacy(OWNER, biz.id)
    assert.equal(res.data.migrated, false)
    assert.equal(res.data.edition, null)
  })

  it('round-trips import/export without losing fields', async () => {
    const biz = await makeBusiness(OWNER)
    const saved = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, fullPlaybook())
    await svc.brandPlaybookService.publish(OWNER, biz.id, saved.data.id, OWNER)
    const current = await svc.brandPlaybookService.getCurrent(OWNER, biz.id)
    const exported = {
      format: 'magicsync-playbook/v1',
      exportedAt: new Date().toISOString(),
      edition: current.data,
    }
    const parsed = svc.BrandPlaybookSchema.safeParse(exported.edition.playbook)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.metadata.schemaVersion, 2)
    assert.equal(parsed.data.identity.name, 'Acme Co')
    const reimported = await svc.brandPlaybookService.saveDraft(OWNER, biz.id, parsed.data)
    assert.equal(reimported.data.hash, saved.data.hash)
  })

  it('creates drafts from intake answers with source provenance', async () => {
    const biz = await makeBusiness(OWNER)
    const res = await svc.brandPlaybookService.createDraftFromIntake(OWNER, biz.id, [
      { group: 'voice', question: 'tone', answer: 'Playful' },
      { group: 'positioning', question: 'edge', answer: 'Same-day delivery' },
    ])
    assert.equal(res.success, true)
    assert.equal(res.data.playbook.voice.tone, 'Playful')
    assert.ok(res.data.playbook.sources.some(s => s.label === 'brand_intake'))
  })

  it('maps identity/audience/verify intake groups into v2 fields', async () => {
    const biz = await makeBusiness(OWNER)
    const res = await svc.brandPlaybookService.createDraftFromIntake(OWNER, biz.id, [
      { group: 'identity', question: 'website', answer: 'https://acme.test' },
      { group: 'identity', question: 'industry', answer: 'Retail' },
      { group: 'identity', question: 'location', answer: 'Austin' },
      { group: 'audience', question: 'primary', answer: 'Shop owners' },
      { group: 'audience', question: 'problem', answer: 'No time' },
      { group: 'audience', question: 'outcome', answer: 'More sales' },
      { group: 'safety', question: 'never', answer: 'Guaranteed rankings' },
      { group: 'verify', question: 'claims', answer: 'Revenue figures' },
    ])
    assert.equal(res.success, true)
    const playbook = res.data.playbook
    assert.equal(playbook.identity.website, 'https://acme.test')
    assert.equal(playbook.identity.industry, 'Retail')
    assert.equal(playbook.identity.location, 'Austin')
    assert.equal(playbook.audience.primary, 'Shop owners')
    assert.equal(playbook.audience.problem, 'No time')
    assert.equal(playbook.audience.outcome, 'More sales')
    assert.deepEqual(playbook.safety.neverSay, ['Guaranteed rankings'])
    assert.deepEqual(playbook.safety.verifyBeforeClaim, ['Revenue figures'])
  })

  it('keeps placeholder markers out of live context', async () => {
    const biz = await makeBusiness(OWNER)
    await svc.businessCorpusService.upsertSection(OWNER, {
      businessId: biz.id,
      section: 'positioning',
      content: 'We serve [audience] with care',
    })
    const prompt = await svc.businessCorpusService.getContextPrompt(biz.id, OWNER)
    assert.ok(!prompt.data.includes('[audience]'))
    assert.equal(svc.isPlaceholderContent('We serve [audience]'), true)
    assert.equal(svc.isUsableContent('We serve neighbors'), true)
  })
})
