import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb } from './setup.mjs'

// Skills import DB services at module load; the file DB must exist first.
let cleanupDb
let routeGoal
let planForGoal
before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  ;({ routeGoal, planForGoal } = await import('../server/agentic/planner.ts'))
})
after(() => cleanupDb())

describe('deterministic goal routing', () => {
  it('routes a growth goal through research, competitors, opportunities and a plan', () => {
    const plan = routeGoal('Help me get more customers')
    assert.ok(plan)
    const skills = plan.steps.map(step => step.skill)
    assert.deepEqual(skills, [
      'research-business',
      'research-competitors',
      'discover-opportunities',
      'create-marketing-plan',
      'identify-next-action',
    ])
    for (const step of plan.steps) assert.ok(step.dependsOn.length <= 1)
  })

  it('routes competitor research with evidence steps', () => {
    const plan = routeGoal('Research my competitors')
    assert.ok(plan)
    assert.equal(plan.steps[0].skill, 'research-competitors')
    assert.ok(plan.steps[0].input.topic)
  })

  it('routes content ideas with the goal as topic', () => {
    const plan = routeGoal('Give me 10 content ideas about roofing')
    assert.ok(plan)
    assert.equal(plan.steps[0].skill, 'create-content-ideas')
    assert.equal(plan.steps[0].input.topic, 'Give me 10 content ideas about roofing')
  })

  it('returns null for unrecognized goals', () => {
    assert.equal(routeGoal('hello world'), null)
  })
})

describe('model-assisted planning', () => {
  it('uses the model only when no deterministic route matches', async () => {
    const planJson = JSON.stringify({
      goal: 'zzz unplannable',
      summary: 'two steps',
      steps: [
        { id: 's1', skill: 'research-business', title: 'Understand', type: 'research', dependsOn: [] },
        { id: 's2', skill: 'analyze-business', title: 'Analyze', type: 'analysis', dependsOn: ['s1'] },
      ],
    })
    let calls = 0
    const complete = async () => {
      calls += 1
      return planJson
    }
    const result = await planForGoal({ goal: 'zzz unplannable', complete })
    assert.equal(result.success, true)
    assert.equal(result.data.steps.length, 2)
    assert.equal(calls, 1)
  })

  it('drops model steps referencing unknown skills, then errors when nothing remains', async () => {
    const planJson = JSON.stringify({
      goal: 'zzz unplannable',
      steps: [
        { id: 's1', skill: 'does-not-exist', title: 'Ghost', type: 'research', dependsOn: [] },
      ],
    })
    const result = await planForGoal({ goal: 'zzz unplannable', complete: async () => planJson })
    assert.equal(result.success, false)
    assert.equal(result.code, 'GOAL_UNPLANABLE')
  })

  it('repairs unparseable model output by falling back to an error', async () => {
    const result = await planForGoal({ goal: 'zzz unplannable', complete: async () => 'no json here' })
    assert.equal(result.success, false)
    assert.equal(result.code, 'GOAL_UNPLANABLE')
  })

  it('never plans without a model when routing fails', async () => {
    const result = await planForGoal({ goal: 'zzz unplannable' })
    assert.equal(result.success, false)
    assert.equal(result.code, 'GOAL_UNPLANABLE')
  })

  it('enforces the step ceiling on model plans', async () => {
    const steps = Array.from({ length: 13 }, (_, index) => ({
      id: `s${index}`, skill: 'research-business', title: 'Step', type: 'research', dependsOn: [],
    }))
    const planJson = JSON.stringify({ goal: 'zzz unplannable', steps })
    const result = await planForGoal({ goal: 'zzz unplannable', complete: async () => planJson })
    assert.equal(result.success, false)
    assert.equal(result.code, 'GOAL_UNPLANABLE')
  })
})
