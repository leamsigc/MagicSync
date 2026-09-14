import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Guard extension: allowlist enforcement + private-mode PII blocking.
let createGuardExtension

function captureHandler(factory) {
  let handler
  const pi = { on: (type, fn) => { if (type === 'tool_call') handler = fn } }
  factory(pi)
  return handler
}

describe('guard extension', () => {
  it('blocks tools outside the session allowlist', async () => {
    ;({ createGuardExtension } = await import('../server/agent/extensions/index.ts'))
    const audits = []
    const handler = captureHandler(createGuardExtension({ allowedTools: ['web_search'], onAudit: entry => audits.push(entry) }))
    const result = await handler({ type: 'tool_call', toolCallId: '1', toolName: 'bash', input: { command: 'rm -rf /' } })
    assert.equal(result.block, true)
    assert.match(result.reason, /TOOL_NOT_ALLOWED/)
    assert.deepEqual(audits, [{ toolName: 'bash', blocked: true, reason: 'TOOL_NOT_ALLOWED' }])
  })

  it('allows listed tools and audits them', async () => {
    const audits = []
    const handler = captureHandler(createGuardExtension({ allowedTools: ['web_search'], onAudit: entry => audits.push(entry) }))
    const result = await handler({ type: 'tool_call', toolCallId: '2', toolName: 'web_search', input: { query: 'ai' } })
    assert.equal(result, undefined)
    assert.deepEqual(audits, [{ toolName: 'web_search', blocked: false }])
  })

  it('blocks raw PII in side-effect tool arguments only in private mode', async () => {
    const args = { caption: 'email maria@example.com' }
    const privateHandler = captureHandler(createGuardExtension({ allowedTools: ['publish'], privateMode: true }))
    const blocked = await privateHandler({ type: 'tool_call', toolCallId: '3', toolName: 'publish', input: args })
    assert.equal(blocked.block, true)
    assert.match(blocked.reason, /PII_BLOCKED/)

    const publicHandler = captureHandler(createGuardExtension({ allowedTools: ['publish'] }))
    const allowed = await publicHandler({ type: 'tool_call', toolCallId: '4', toolName: 'publish', input: args })
    assert.equal(allowed, undefined)
  })

  it('does not scan non-side-effect tools in private mode', async () => {
    const handler = captureHandler(createGuardExtension({ allowedTools: ['web_search'], privateMode: true }))
    const result = await handler({ type: 'tool_call', toolCallId: '5', toolName: 'web_search', input: { query: 'maria@example.com' } })
    assert.equal(result, undefined)
  })
})
