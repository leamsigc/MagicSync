import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// Skills and the orchestrator import DB services at module load; the file DB
// must exist before any of them is imported.
let cleanupDb
let skillRegistry
let goalOrchestratorService
let db
let schema

const OWNER = 'goal-owner'
const BUSINESS = 'goal-business'

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanupDb = init.cleanup
  await insertUser(db, { id: OWNER, email: 'goal@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Goal Co' })
  ;({ skillRegistry } = await import('../server/agentic/skill-registry.ts'))
  ;({ goalOrchestratorService } = await import('../server/agentic/goal-orchestrator.service.ts'))
})
after(() => cleanupDb())

function registerTestSkill(id, result, overrides = {}) {
  const skill = {
    id,
    name: id,
    description: `Test skill ${id}`,
    inputSchema: { safeParse: input => ({ success: true, data: input ?? {} }) },
    outputSchema: { safeParse: () => ({ success: true, data: {} }) },
    requiredContext: [],
    requiredTools: [],
    consequential: false,
    verify: () => ({ ok: true }),
    run: async () => ({ success: true, data: result }),
    ...overrides,
  }
  skillRegistry.register(skill)
  return skill
}

function planFor(ids) {
  return JSON.stringify({
    goal: 'test goal alpha',
    steps: ids.map((entry, index) => ({
      id: entry.skill,
      skill: entry.skill,
      title: entry.title ?? entry.skill,
      type: 'research',
      dependsOn: index === 0 ? [] : [ids[index - 1].skill],
    })),
  })
}

function runInput(overrides = {}) {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    goal: 'test goal alpha',
    complete: async () => '',
    onEvent: () => {},
    ...overrides,
  }
}

async function loadRun(runId) {
  const rows = await db.select().from(schema.agentGoalRuns).where(eq(schema.agentGoalRuns.id, runId))
  return rows[0]
}

describe('agentic orchestrator', () => {
  it('executes a successful multi-step goal with progress and persistence', async () => {
    registerTestSkill('test-a', { fact: 'a' })
    registerTestSkill('test-b', { fact: 'b' })
    const events = []
    const outcome = await goalOrchestratorService.executeGoal(runInput({
      complete: async () => planFor([{ skill: 'test-a' }, { skill: 'test-b' }]),
      onEvent: event => events.push(event),
    }))
    assert.equal(outcome.status, 'completed')
    assert.deepEqual(outcome.result.steps.map(step => step.status), ['completed', 'completed'])
    const stepEvents = events.filter(event => event.type === 'goal.step')
    assert.equal(stepEvents.length, 4)
    assert.equal(stepEvents[0].status, 'running')
    assert.equal(stepEvents[1].status, 'completed')
    const row = await loadRun(outcome.goalRunId)
    assert.equal(row.status, 'completed')
    assert.equal(JSON.parse(row.steps)[0].result.fact, 'a')
  })

  it('fails the run on fatal skill errors without retrying', async () => {
    let calls = 0
    registerTestSkill('test-fatal', null, {
      run: async () => {
        calls += 1
        return { success: false, error: 'boom', code: 'FATAL_ERROR' }
      },
    })
    const outcome = await goalOrchestratorService.executeGoal(runInput({
      complete: async () => planFor([{ skill: 'test-fatal' }]),
    }))
    assert.equal(outcome.status, 'failed')
    assert.match(outcome.error, /test-fatal failed: boom/)
    assert.equal(calls, 1)
  })

  it('retries retryable failures within bounds and recovers', async () => {
    let calls = 0
    registerTestSkill('test-retry', { ok: true }, {
      run: async () => {
        calls += 1
        if (calls < 3) return { success: false, error: 'temporary network error', code: 'PROVIDER_FAILED' }
        return { success: true, data: { ok: true } }
      },
    })
    const outcome = await goalOrchestratorService.executeGoal(runInput({
      complete: async () => planFor([{ skill: 'test-retry' }]),
    }))
    assert.equal(outcome.status, 'completed')
    assert.equal(calls, 3)
  })

  it('reports requires-user failures as input requests without retries', async () => {
    let calls = 0
    registerTestSkill('test-user', null, {
      run: async () => {
        calls += 1
        return { success: false, error: 'LangSearch is not configured', code: 'LANGSEARCH_NOT_CONFIGURED' }
      },
    })
    const outcome = await goalOrchestratorService.executeGoal(runInput({
      complete: async () => planFor([{ skill: 'test-user' }]),
    }))
    assert.equal(outcome.status, 'failed')
    assert.match(outcome.error, /needs your input/)
    assert.equal(calls, 1)
  })

  it('pauses on consequential steps and cancels on rejection', async () => {
    registerTestSkill('test-approval', { done: true }, { consequential: true })
    const paused = await goalOrchestratorService.executeGoal(runInput({
      complete: async () => planFor([{ skill: 'test-approval' }]),
    }))
    assert.equal(paused.status, 'waiting_for_approval')
    assert.ok(paused.stepId)
    const row = await loadRun(paused.goalRunId)
    assert.equal(row.status, 'waiting_for_approval')
    const rejected = await goalOrchestratorService.resume({
      userId: OWNER,
      runId: paused.goalRunId,
      approved: false,
      complete: async () => '',
    })
    assert.equal(rejected.status, 'cancelled')
  })

  it('resumes a paused run on approval', async () => {
    const paused = await goalOrchestratorService.executeGoal(runInput({
      complete: async () => planFor([{ skill: 'test-approval' }]),
    }))
    assert.equal(paused.status, 'waiting_for_approval')
    const resumed = await goalOrchestratorService.resume({
      userId: OWNER,
      runId: paused.goalRunId,
      approved: true,
      complete: async () => '',
    })
    assert.equal(resumed.status, 'completed')
    const row = await loadRun(paused.goalRunId)
    assert.equal(row.status, 'completed')
  })

  it('fails cleanly when the model proposes unknown skills', async () => {
    const outcome = await goalOrchestratorService.executeGoal(runInput({
      complete: async () => planFor([{ skill: 'ghost-skill' }]),
    }))
    assert.equal(outcome.status, 'failed')
  })

  it('rejects resume of a run that is not paused', async () => {
    const outcome = await goalOrchestratorService.resume({
      userId: OWNER,
      runId: 'no-such-run',
      approved: true,
      complete: async () => '',
    })
    assert.equal(outcome.status, 'failed')
    assert.equal(outcome.code, 'NOT_FOUND')
  })
})
