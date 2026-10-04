import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { init } from '@flue/runtime'
import { initTestDb } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'

// The bound chat path (`MagicSyncAgent` + `bindAgentConversation`) must offer
// the four specialists to the model. A run that declares none tells the model
// "`task` has no valid `agent` value" and every delegation fails with
// `SubagentNotDeclaredError`.

let cleanupDb
before(async () => { cleanupDb = (await initTestDb()).cleanup })
after(async () => { await cleanupDb?.() })

const SPECIALIST_NAMES = ['business-agent', 'research-agent', 'strategy-agent', 'content-agent']

async function bootBoundConversation(t, { withSpecialists }) {
  const stub = await startStubProvider({ toolScript: [], finalText: 'Understood.' })
  const { registerBusinessProvider, stopFlueRuntime, getFlueRuntime } = await import('../server/flue/runtime.ts')
  const { bindAgentConversation, releaseAgentConversation } = await import('../server/flue/agent-bindings.ts')
  const { MagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
  t.after(async () => {
    await stopFlueRuntime()
    await stub.close()
  })
  const registration = registerBusinessProvider({
    businessId: 'bound-subagents',
    provider: 'stub',
    model: 'stub-model',
    apiKey: 'stub-key',
    apiBaseUrl: stub.url,
  })
  await getFlueRuntime({ agents: [MagicSyncAgent] })
  const conversationId = `bound-subagents-${Math.random().toString(36).slice(2)}`
  const binding = {
    model: registration.modelSpecifier,
    instructions: 'Answer briefly.',
    tools: [],
  }
  if (withSpecialists) {
    const { createSpecialistSubagents } = await import('../server/flue/specialists.ts')
    binding.subagents = createSpecialistSubagents({ model: registration.modelSpecifier })
  }
  bindAgentConversation(conversationId, binding)
  t.after(() => releaseAgentConversation(conversationId))
  return { stub, conversationId, MagicSyncAgent }
}

function systemText(stub) {
  const systemMessage = stub.requests[0].messages.find(message => message.role === 'system')
  assert.ok(systemMessage, 'the provider saw a system message')
  return systemMessage.content
}

test('a bound run declares the four specialists to the model', async (t) => {
  const { stub, conversationId, MagicSyncAgent } = await bootBoundConversation(t, { withSpecialists: true })
  const handle = init(MagicSyncAgent, { id: conversationId })
  const receipt = await handle.dispatch({ message: 'Who can research for me?' })
  const reply = await handle.read(receipt)
  assert.equal(reply.text.trim(), 'Understood.')
  const prompt = systemText(stub)
  for (const name of SPECIALIST_NAMES) {
    assert.ok(prompt.includes(`**${name}**`), `the roster names ${name}`)
  }
  assert.ok(!prompt.includes('No subagents are currently declared'), 'no empty-roster notice')
})

test('a run without subagents keeps the empty-roster notice', async (t) => {
  const { stub, conversationId, MagicSyncAgent } = await bootBoundConversation(t, { withSpecialists: false })
  const handle = init(MagicSyncAgent, { id: conversationId })
  const receipt = await handle.dispatch({ message: 'Who can research for me?' })
  await handle.read(receipt)
  assert.ok(
    systemText(stub).includes('No subagents are currently declared'),
    'the spike path still declares nothing',
  )
})
