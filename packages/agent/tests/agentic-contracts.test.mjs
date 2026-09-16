import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AgentPlanSchema,
  GoalStepSchema,
  GOAL_RUN_STATUSES,
  GOAL_STEP_TYPES,
  MAX_PLAN_STEPS,
} from '../server/agentic/contracts.ts'

test('plans accept valid linear steps with defaults', () => {
  const plan = AgentPlanSchema.safeParse({
    goal: 'Help me get more customers',
    steps: [
      { id: 's1', skill: 'research-business', title: 'Understand', type: 'research' },
      { id: 's2', skill: 'discover-opportunities', title: 'Find', type: 'analysis', dependsOn: ['s1'] },
    ],
  })
  assert.equal(plan.success, true)
  assert.deepEqual(plan.data.steps[0].dependsOn, [])
})

test('plans reject empty step lists', () => {
  const plan = AgentPlanSchema.safeParse({ goal: 'x', steps: [] })
  assert.equal(plan.success, false)
})

test('plans reject more than the max steps', () => {
  const steps = Array.from({ length: MAX_PLAN_STEPS + 1 }, (_, index) => ({
    id: `s${index}`,
    skill: 'research-business',
    title: 'Step',
    type: 'research',
  }))
  const plan = AgentPlanSchema.safeParse({ goal: 'x', steps })
  assert.equal(plan.success, false)
  assert.ok(MAX_PLAN_STEPS <= 12)
})

test('steps reject unknown types and missing fields', () => {
  assert.equal(GoalStepSchema.safeParse({ id: 'a', skill: 'x', title: 't', type: 'banana' }).success, false)
  assert.equal(GoalStepSchema.safeParse({ id: 'a', title: 't', type: 'research' }).success, false)
  assert.deepEqual([...GOAL_STEP_TYPES], ['research', 'analysis', 'creation', 'planning', 'monitoring'])
  assert.ok(GOAL_RUN_STATUSES.includes('waiting_for_approval'))
})

test('steps accept optional structured input', () => {
  const step = GoalStepSchema.safeParse({
    id: 'ideas', skill: 'create-content-ideas', title: 'Ideas', type: 'creation',
    input: { topic: 'roofing', quantity: 10 },
  })
  assert.equal(step.success, true)
  assert.equal(step.data.input.topic, 'roofing')
})
