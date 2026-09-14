import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// Predefined agents + PII tool + registry seeding from the runtime registry.
const OWNER = 'predef-owner'
const BUSINESS = 'predef-business'

let cleanup
let db
let PREDEFINED_AGENTS
let delegatableAgents
let AGENT_PROMPTS
let AGENT_TOOL_NAMES
let BUNDLED_SKILLS
let createAgentTools
let createAgentToolContext
let agentRegistryService
let skillRegistryService

function parseResult(result) {
  return JSON.parse(result.content[0].text)
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'predef@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Predef Co' })
  ;({ PREDEFINED_AGENTS, delegatableAgents } = await import('../server/agent/agents.ts'))
  ;({ AGENT_PROMPTS } = await import('../server/agent/prompts/index.ts'))
  ;({ AGENT_TOOL_NAMES } = await import('../server/agent/tool-catalog.ts'))
  ;({ BUNDLED_SKILLS } = await import('../server/agent/skills/index.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  ;({ agentRegistryService } = await import('#layers/BaseDB/server/services/agent-registry.service.ts'))
  ;({ skillRegistryService } = await import('#layers/BaseDB/server/services/skill-registry.service.ts'))
})

after(() => cleanup())

describe('predefined agents registry', () => {
  it('keeps names unique and every reference resolvable', () => {
    const names = PREDEFINED_AGENTS.map(agent => agent.name)
    assert.equal(new Set(names).size, names.length)
    const skillSlugs = new Set(BUNDLED_SKILLS.map(skill => skill.slug))
    const toolNames = new Set(AGENT_TOOL_NAMES)
    for (const agent of PREDEFINED_AGENTS) {
      assert.ok(AGENT_PROMPTS[agent.prompt], `${agent.name} prompt ${agent.prompt} exists`)
      assert.ok(agent.description.length >= 20, `${agent.name} has a description`)
      for (const tool of agent.tools) assert.ok(toolNames.has(tool), `${agent.name} tool ${tool} is catalogued`)
      for (const skill of agent.skills) assert.ok(skillSlugs.has(skill), `${agent.name} skill ${skill} exists`)
      for (const skill of agent.forceSkills) assert.ok(skillSlugs.has(skill), `${agent.name} force skill ${skill} exists`)
      assert.ok(['research_result', 'social_post_draft', 'humanized_social_post', 'fabric_scene', 'reel_storyboard', 'approval_request', 'publishing_intent'].includes(agent.outputKind))
    }
  })

  it('gives the orchestrator the full tool catalog and excludes it from delegation', () => {
    const orchestrator = PREDEFINED_AGENTS.find(agent => agent.name === 'orchestrator')
    assert.deepEqual(orchestrator.tools, AGENT_TOOL_NAMES)
    assert.ok(orchestrator.forceSkills.includes('content-ops'))
    assert.ok(!delegatableAgents().some(agent => agent.name === 'orchestrator'))
    assert.deepEqual(
      delegatableAgents().map(agent => agent.name).sort(),
      ['humanizer', 'pii-guardian', 'researcher', 'trend-scout', 'writer'],
    )
  })

  it('every agent tool name maps to an implemented tool', () => {
    const implemented = new Set(createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS })).map(tool => tool.name))
    for (const agent of delegatableAgents()) {
      for (const tool of agent.tools) assert.ok(implemented.has(tool), `${agent.name}: ${tool} is implemented`)
    }
  })

  it('seeds the runtime registry into the DB idempotently', async () => {
    const seed = {
      skills: BUNDLED_SKILLS.map(skill => ({
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        instructions: skill.body,
        tools: skill.tools,
      })),
      agents: PREDEFINED_AGENTS.map(agent => ({
        name: agent.name,
        description: agent.description,
        systemPrompt: AGENT_PROMPTS[agent.prompt],
        skills: agent.skills,
        tools: agent.tools,
        outputKind: agent.outputKind,
        requiresHumanReview: agent.requiresHumanReview,
      })),
    }
    const first = await agentRegistryService.ensureBuiltins(OWNER, BUSINESS, OWNER, {}, seed)
    assert.equal(first.success, true)
    assert.equal(first.data.agents, PREDEFINED_AGENTS.length)
    assert.equal(first.data.skills, BUNDLED_SKILLS.length)

    const second = await agentRegistryService.ensureBuiltins(OWNER, BUSINESS, OWNER, {}, seed)
    assert.deepEqual(second.data, { skills: 0, agents: 0 })

    const agents = await agentRegistryService.listAgents(OWNER, BUSINESS, {})
    const researcher = agents.data.find(row => row.name === 'researcher')
    assert.ok(researcher)
    assert.equal(JSON.parse(researcher.allowedToolNames).includes('web_search'), true)
    const piiAgent = agents.data.find(row => row.name === 'pii-guardian')
    assert.ok(piiAgent)
    assert.equal(piiAgent.requiresHumanReview, true)
    const skills = await skillRegistryService.listSkills(OWNER, BUSINESS, {})
    assert.equal(skills.success, true)
    assert.ok(skills.data.some(row => row.slug === 'langsearch'))
  })
})

describe('pii_scan tool', () => {
  function findPiiTool() {
    const tool = createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS }))
      .find(entry => entry.name === 'pii_scan')
    assert.ok(tool, 'pii_scan tool exists')
    return tool
  }

  it('reports masked findings without raw values', async () => {
    const text = 'Email maria@example.com or call +34 600 123 456.'
    const payload = parseResult(await findPiiTool().execute('call-1', { text }, undefined, undefined, undefined))
    assert.ok(['none', 'low', 'high'].includes(payload.risk))
    const types = payload.findings.map(finding => finding.type)
    assert.ok(types.includes('EMAIL'))
    assert.ok(types.includes('PHONE'))
    assert.ok(!JSON.stringify(payload).includes('maria@example.com'))
    assert.ok(!JSON.stringify(payload).includes('600 123 456'))
  })

  it('anonymizes text with placeholders and no mapping values', async () => {
    const text = 'Contact maria@example.com for details.'
    const payload = parseResult(await findPiiTool().execute('call-2', { text, action: 'anonymize' }, undefined, undefined, undefined))
    assert.match(payload.text, /\[EMAIL_1\]/)
    assert.ok(!JSON.stringify(payload).includes('maria@example.com'))
    assert.ok(payload.mappings.every(mapping => !('value' in mapping)))
  })
})
