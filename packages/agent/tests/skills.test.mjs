import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

// Bundled system skills: markdown source of truth + load_skill tool surface.
const OWNER = 'skills-owner'
const BUSINESS = 'skills-business'

let cleanup
let createAgentTools
let createAgentToolContext
let BUNDLED_SKILLS
let findBundledSkill
let formatBundledSkillsForPrompt

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'skills@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Skills Co' })
  ;({ BUNDLED_SKILLS, findBundledSkill, formatBundledSkillsForPrompt } = await import('../server/flue/skills.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
})

after(() => cleanup())

describe('bundled skills registry', () => {
  // `content-score` is prompt-only: its SKILL.md says "You do not fetch
  // anything yourself", because link probes reach it pre-measured.
  const PROMPT_ONLY_IDS = ['content-score']

  it('parses every SKILL.md frontmatter into a usable registry entry', () => {
    assert.ok(BUNDLED_SKILLS.length >= 7)
    for (const skill of BUNDLED_SKILLS) {
      assert.match(skill.name, /^[a-z0-9-]+$/, `${skill.slug} has a spec-compliant name`)
      assert.ok(skill.description.length >= 40, `${skill.slug} description is trigger-rich`)
      assert.ok(skill.body.includes('---'), `${skill.slug} keeps its frontmatter`)
      assert.ok(
        skill.tools.length > 0 || PROMPT_ONLY_IDS.includes(skill.slug),
        `${skill.slug} names its tools or is a declared prompt-only skill`,
      )
    }
    assert.equal(findBundledSkill('langsearch')?.slug, 'langsearch')
    assert.equal(findBundledSkill('web_search'), undefined)
  })

  it('formats the available-skills prompt block', () => {
    const block = formatBundledSkillsForPrompt(BUNDLED_SKILLS)
    assert.match(block, /<available_skills>/)
    assert.match(block, /<name>langsearch<\/name>/)
    assert.match(block, /load_skill/)
    assert.equal(formatBundledSkillsForPrompt([]), '')
  })

  it('keeps the LangSearch skill free of key material', () => {
    const skill = findBundledSkill('langsearch')
    assert.ok(!/LANGSEARCH_API_KEY\s*=/.test(skill.body), 'no key assignment in the skill body')
    assert.match(skill.body, /web_search/)
  })
})

describe('skills tools', () => {
  function tools() {
    return createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS }))
  }

  it('lists bundled and registry skills together', async () => {
    const tool = tools().find(entry => entry.name === 'list_skills')
    const payload = await runTool(tool)
    const bundled = payload.skills.filter(skill => skill.source === 'bundled')
    assert.ok(bundled.some(skill => skill.slug === 'langsearch'))
  })

  it('loads a bundled skill body and its reference file', async () => {
    const tool = tools().find(entry => entry.name === 'load_skill')
    const body = await runTool(tool, { skillId: 'social-research' })
    assert.equal(body.source, 'bundled')
    assert.match(body.content, /Social Research/)
    assert.deepEqual(body.references, ['references/evidence-rubric.md'])

    const reference = await runTool(tool, { skillId: 'social-research', file: './references/evidence-rubric.md' })
    assert.match(reference.content, /Evidence rubric/)
  })

  it('fails with a typed error for unknown skills and references', async () => {
    const tool = tools().find(entry => entry.name === 'load_skill')
    await assert.rejects(
      () => runTool(tool, { skillId: 'nope' }),
      /NOT_FOUND/,
    )
    await assert.rejects(
      () => runTool(tool, { skillId: 'langsearch', file: 'references/nope.md' }),
      /NOT_FOUND/,
    )
  })
})
