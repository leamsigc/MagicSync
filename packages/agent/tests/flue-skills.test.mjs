import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T07: one Flue skill set (PRD §7.2) — the seven goal skills plus the chat
 * skills in the open Agent Skills format, valid frontmatter, contracts kept.
 */

const OWNER = 'flue-skills-owner'
const BUSINESS = 'flue-skills-business'

let cleanupDb
let skills

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'flue-skills@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Flue Skills Co' })
  skills = await import('../server/flue/skills.ts')
})

after(() => cleanupDb())

const GOAL_IDS = [
  'research-business',
  'research-competitors',
  'analyze-business',
  'discover-opportunities',
  'create-marketing-plan',
  'identify-next-action',
  'create-content-ideas',
]

const CHAT_IDS = [
  'langsearch',
  'social-research',
  'content-writer',
  'humanizer',
  'trend-scout',
  'content-ops',
  'carousel',
  'content-score',
]

/**
 * `content-score` is prompt-only by design — its SKILL.md says "You do not
 * fetch anything yourself", because the link probes reach it pre-measured. So a
 * skill declaring no tools is legitimate; what must hold is that every chat
 * skill either names its tools or is one of the known prompt-only skills.
 */
const PROMPT_ONLY_IDS = ['content-score']

describe('single Flue skill set (T07)', () => {
  it('declares every skill exactly once with valid Agent Skills frontmatter', () => {
    assert.equal(skills.FLUE_SKILLS.length, GOAL_IDS.length + CHAT_IDS.length, 'goal + chat skills, one set')
    const ids = skills.FLUE_SKILLS.map(entry => entry.id)
    assert.equal(new Set(ids).size, ids.length, 'no duplicate skill ids')
    for (const entry of skills.FLUE_SKILLS) {
      const meta = skills.parseSkillMeta(entry.definition.instructions)
      assert.ok(meta, `${entry.id} frontmatter parses`)
      assert.match(meta.name, /^[a-z0-9-]+$/, `${entry.id} name is spec-compliant`)
      assert.ok(meta.description.length >= 20, `${entry.id} description is trigger-rich`)
      assert.ok(entry.definition.instructions.includes('#'), `${entry.id} keeps its instruction body`)
    }
  })

  it('keeps the seven goal skills with their input/output contracts', () => {
    for (const id of GOAL_IDS) {
      const entry = skills.getFlueSkill(id)
      assert.ok(entry, `${id} declared`)
      assert.equal(entry.kind, 'goal')
      assert.ok(entry.executable, `${id} keeps its implementation`)
      const parsed = entry.executable.inputSchema.safeParse({})
      assert.equal(typeof parsed.success, 'boolean', `${id} input contract verifiable`)
      assert.equal(entry.executable.outputSchema.safeParse('nope').success, false, `${id} output contract rejects junk`)
    }
    assert.equal(skills.goalSkillRegistry.list().length, 7)
    assert.ok(skills.goalSkillRegistry.has('research-business'))
    assert.ok(skills.goalSkillRegistry.catalog().every(row => row.id && row.description))
  })

  it('serves the chat skills through the unchanged pi facet', () => {
    assert.equal(skills.BUNDLED_SKILLS.length, CHAT_IDS.length)
    for (const skill of skills.BUNDLED_SKILLS) {
      assert.ok(skill.body.includes('---'), `${skill.slug} keeps its frontmatter`)
      assert.ok(
        skill.tools.length > 0 || PROMPT_ONLY_IDS.includes(skill.slug),
        `${skill.slug} names its tools or is a declared prompt-only skill`,
      )
    }
    assert.equal(skills.findBundledSkill('langsearch')?.slug, 'langsearch')
    assert.equal(skills.findBundledSkill('nope'), undefined)
    assert.ok(skills.selectBundledSkills(['carousel']).length === 1)
    assert.ok(skills.formatBundledSkillsForPrompt(skills.BUNDLED_SKILLS).includes('<available_skills>'))
    const social = skills.findBundledSkill('social-research')
    assert.ok(social && skills.loadBundledReference(social, 'references/evidence-rubric.md')?.length > 0)
  })

  it('rejects invalid frontmatter at load', () => {
    assert.throws(() => skills.validateSkillFrontmatter('bad', 'no frontmatter here'), /invalid frontmatter/)
  })

  it('has no orphan SKILL.md: every skill file on disk is declared', async () => {
    const { readdirSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const roots = [
      join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'agent', 'skills'),
      join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'agentic', 'skills'),
    ]
    const onDisk = []
    for (const root of roots) {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) onDisk.push(entry.name)
      }
    }
    const declared = new Set(skills.FLUE_SKILLS.map(entry => entry.id))
    for (const dir of onDisk) {
      if (dir === 'references') continue
      assert.ok(declared.has(dir), `SKILL.md directory ${dir} is declared in the single set`)
    }
  })
})
