import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENT_LIMIT_DEFAULTS,
  checkTokenBudget,
  enforceToolCallLimit,
  enforceTurnLimit,
  readAgentLimits,
  withConcurrency,
  withToolTimeout,
} from '../server/utils/agent-limits.ts'

describe('agent limits (T02)', () => {
  it('reads defaults and env overrides', () => {
    assert.deepEqual(readAgentLimits({}), AGENT_LIMIT_DEFAULTS)

    const custom = readAgentLimits({
      AGENT_MAX_TURNS: '3',
      AGENT_TOKEN_BUDGET: '1000',
      AGENT_MAX_CONCURRENCY: 'bogus',
    })
    assert.equal(custom.maxTurns, 3)
    assert.equal(custom.tokenBudget, 1000)
    assert.equal(custom.maxConcurrency, AGENT_LIMIT_DEFAULTS.maxConcurrency)
  })

  it('enforces turn and tool-call limits at the boundary', () => {
    const limits = { ...AGENT_LIMIT_DEFAULTS, maxTurns: 2, maxToolCalls: 1 }
    assert.equal(enforceTurnLimit(1, limits).allowed, true)

    const turnLimit = enforceTurnLimit(2, limits)
    assert.equal(turnLimit.allowed, false)
    assert.equal(turnLimit.code, 'AGENT_TURN_LIMIT')

    assert.equal(enforceToolCallLimit(0, limits).allowed, true)
    assert.equal(enforceToolCallLimit(1, limits).code, 'AGENT_TOOL_CALL_LIMIT')
  })

  it('checks the token budget', () => {
    const limits = { ...AGENT_LIMIT_DEFAULTS, tokenBudget: 10 }
    assert.equal(checkTokenBudget(9, limits).allowed, true)
    assert.equal(checkTokenBudget(10, limits).code, 'AGENT_TOKEN_BUDGET')
  })

  it('aborts a tool that exceeds the timeout', async () => {
    const limits = { ...AGENT_LIMIT_DEFAULTS, toolTimeoutMs: 20 }
    const slowTool = (signal) => new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('should have aborted')), 1000)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      })
    })
    await assert.rejects(withToolTimeout(slowTool, limits), /aborted/)
  })

  it('bounds concurrency', async () => {
    let inFlight = 0
    let peak = 0
    const tasks = Array.from({ length: 6 }, () => async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise(resolve => setTimeout(resolve, 10))
      inFlight -= 1
      return 'ok'
    })

    const results = await withConcurrency(tasks, 2)
    assert.equal(results.length, 6)
    assert.equal(peak, 2)
  })
})
