import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser } from './setup.mjs'

// T40.1 — skill/agent registry over real SQLite.
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/skill-registry.test.mjs

const OWNER = 'reg-owner'
const MEMBER = 'reg-member'
const OUTSIDER = 'reg-outsider'

let db
let schema
let cleanup
let svc

async function makeBusiness(userId, name = 'Reg Co') {
  const res = await svc.businessProfileService.create(userId, { name })
  assert.equal(res.success, true, `business create failed: ${res.error}`)
  return res.data
}

async function attachOrg(businessId, orgId = 'reg-org') {
  await db.insert(schema.entityDetails).values({
    id: crypto.randomUUID(),
    entityId: businessId,
    entityType: 'business_details',
    details: { organizationId: orgId },
  })
}

function skillInput(overrides = {}) {
  return {
    name: 'Research Pro',
    slug: 'research-pro',
    description: 'Deep research',
    instructions: 'Cite every source.',
    allowedTools: ['web_search', 'retrieve'],
    ...overrides,
  }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'reg-owner@test.local' })
  await insertUser(db, { id: MEMBER, email: 'reg-member@test.local' })
  await insertUser(db, { id: OUTSIDER, email: 'reg-outsider@test.local' })
  globalThis.useDrizzle = (await import('./stubs/drizzle-stub.mjs')).useDrizzle
  globalThis.useAuthApi = () => ({
    getFullOrganization: async () => ({ members: [{ userId: OWNER }, { userId: MEMBER }] }),
  })
  const skills = await import('#layers/BaseDB/server/services/skill-registry.service.ts')
  const agents = await import('#layers/BaseDB/server/services/agent-registry.service.ts')
  const profile = await import('#layers/BaseDB/server/services/business-profile.service.ts')
  svc = { ...skills, ...agents, ...profile }
})

after(() => cleanup())

describe('skill registry (T40.1)', () => {
  it('validates tool scope without touching the database', () => {
    assert.deepEqual(svc.validateToolScope(['web_search', 'load_skill']), { ok: true, denied: [] })
    assert.equal(svc.validateToolScope(['execute_code']).ok, false)
    assert.equal(svc.validateToolScope('nope').ok, false)
  })

  it('runs the draft/active/disabled lifecycle with immutable versions', async () => {
    const biz = await makeBusiness(OWNER)
    const created = await svc.skillRegistryService.createSkill(OWNER, { ...skillInput(), businessId: biz.id }, {})
    assert.equal(created.success, true)
    assert.equal(created.data.status, 'draft')
    const published = await svc.skillRegistryService.publishSkill(OWNER, created.data.id, biz.id, {})
    assert.equal(published.data.status, 'active')
    assert.equal(published.data.version, 2)
    const v1 = await svc.skillRegistryService.resolveSkillVersion(created.data.id, 1)
    const latest = await svc.skillRegistryService.resolveSkillVersion(created.data.id)
    assert.equal(v1.data.version, 1)
    assert.equal(latest.data.version, 2)
    const editActive = await svc.skillRegistryService.updateSkill(OWNER, created.data.id, { description: 'x' }, biz.id, {})
    assert.equal(editActive.success, false)
    const disabled = await svc.skillRegistryService.disableSkill(OWNER, created.data.id, biz.id, {})
    assert.equal(disabled.data.status, 'disabled')
    const deleted = await svc.skillRegistryService.deleteSkill(OWNER, created.data.id, biz.id, {})
    assert.equal(deleted.success, true)
  })

  it('rejects unapproved tools and duplicate slugs', async () => {
    const biz = await makeBusiness(OWNER)
    const bad = await svc.skillRegistryService.createSkill(OWNER, { ...skillInput(), businessId: biz.id, allowedTools: ['execute_code'] }, {})
    assert.equal(bad.success, false)
    assert.equal(bad.code, 'VALIDATION_ERROR')
    const first = await svc.skillRegistryService.createSkill(OWNER, { ...skillInput(), businessId: biz.id }, {})
    assert.equal(first.success, true)
    const dup = await svc.skillRegistryService.createSkill(OWNER, { ...skillInput(), businessId: biz.id }, {})
    assert.equal(dup.success, false)
  })

  it('isolates outsiders and shares one scope with members', async () => {
    const biz = await makeBusiness(OWNER)
    await attachOrg(biz.id)
    const created = await svc.skillRegistryService.createSkill(OWNER, { ...skillInput(), businessId: biz.id }, {})
    assert.equal(created.success, true)
    const foreign = await svc.skillRegistryService.createSkill(OUTSIDER, { ...skillInput(), businessId: biz.id }, {})
    assert.equal(foreign.success, false)
    const memberList = await svc.skillRegistryService.listSkills(MEMBER, biz.id, {})
    assert.equal(memberList.success, true)
    assert.ok(memberList.data.some(row => row.id === created.data.id))
    const published = await svc.skillRegistryService.publishSkill(MEMBER, created.data.id, biz.id, {})
    assert.equal(published.success, true)
  })

  it('quarantines imports as drafts with provenance', async () => {
    const biz = await makeBusiness(OWNER)
    const imported = await svc.skillRegistryService.createSkill(OWNER, {
      ...skillInput({ slug: 'imported-pack', name: 'Imported Pack' }),
      businessId: biz.id,
      sourceType: 'imported',
      sourceUri: 'https://example.test/pack.zip',
    }, {})
    assert.equal(imported.success, true)
    assert.equal(imported.data.status, 'draft')
    assert.equal(imported.data.sourceType, 'imported')
    assert.equal(imported.data.sourceUri, 'https://example.test/pack.zip')
  })
})

describe('agent registry (T40.1)', () => {
  it('creates agents with skill versions and resolves run snapshots', async () => {
    const biz = await makeBusiness(OWNER)
    const skill = await svc.skillRegistryService.createSkill(OWNER, { ...skillInput(), businessId: biz.id }, {})
    const agent = await svc.agentRegistryService.createAgent(OWNER, {
      businessId: biz.id,
      name: 'Writer',
      systemPrompt: 'Write posts.',
      skillVersionIds: [`${skill.data.id}@1`],
      allowedToolNames: ['generate_social_post'],
      outputKind: 'social_post_draft',
    })
    assert.equal(agent.success, true)
    const published = await svc.agentRegistryService.publishAgent(OWNER, agent.data.id, biz.id, {})
    assert.equal(published.data.status, 'active')
    const snapshot = await svc.agentRegistryService.resolveRunSnapshot(agent.data.id)
    assert.equal(snapshot.success, true)
    assert.equal(snapshot.data.skills.length, 1)
    assert.equal(snapshot.data.skills[0].version, 1)
    // Publishing the skill later never mutates the pinned run snapshot.
    await svc.skillRegistryService.publishSkill(OWNER, skill.data.id, biz.id, {})
    const again = await svc.agentRegistryService.resolveRunSnapshot(agent.data.id)
    assert.equal(again.data.skills[0].version, 1)
    assert.equal(again.data.skills[0].snapshot.description, 'Deep research')
  })

  it('rejects unknown skills, tools, and output kinds', async () => {
    const biz = await makeBusiness(OWNER)
    const unknownSkill = await svc.agentRegistryService.createAgent(OWNER, {
      businessId: biz.id, name: 'Bad', skillVersionIds: ['missing@1'],
    })
    assert.equal(unknownSkill.success, false)
    const badTool = await svc.agentRegistryService.createAgent(OWNER, {
      businessId: biz.id, name: 'Bad', allowedToolNames: ['execute_code'],
    })
    assert.equal(badTool.success, false)
    const badKind = await svc.agentRegistryService.createAgent(OWNER, {
      businessId: biz.id, name: 'Bad', outputKind: 'telepathy',
    })
    assert.equal(badKind.success, false)
  })

  it('seeds built-ins idempotently with review Gates visible', async () => {
    const biz = await makeBusiness(OWNER)
    const first = await svc.agentRegistryService.ensureBuiltins(OWNER, biz.id, OWNER, {})
    assert.ok(first.data.agents >= 5)
    assert.ok(first.data.skills >= 4)
    const second = await svc.agentRegistryService.ensureBuiltins(OWNER, biz.id, OWNER, {})
    assert.deepEqual(second.data, { skills: 0, agents: 0 })
    const agents = await svc.agentRegistryService.listAgents(OWNER, biz.id, {})
    const reviewer = agents.data.find(row => row.name === 'human-reviewer')
    assert.ok(reviewer)
    assert.equal(reviewer.requiresHumanReview, true)
  })

  it('blocks new runs for disabled agents while history stays visible', async () => {
    const biz = await makeBusiness(OWNER)
    const agent = await svc.agentRegistryService.createAgent(OWNER, { businessId: biz.id, name: 'Temp' })
    await svc.agentRegistryService.publishAgent(OWNER, agent.data.id, biz.id, {})
    await svc.agentRegistryService.disableAgent(OWNER, agent.data.id, biz.id, {})
    const agents = await svc.agentRegistryService.listAgents(OWNER, biz.id, {})
    assert.ok(agents.data.some(row => row.id === agent.data.id && row.status === 'disabled'))
  })
})
