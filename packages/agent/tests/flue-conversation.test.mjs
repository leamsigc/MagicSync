import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { defineTool, getAgentInstance, init } from '@flue/runtime'
import * as v from 'valibot'
import { initTestDb } from './setup.mjs'
import { startStubProvider } from './stub-provider.mjs'

/**
 * T29 — conversation continuity on Flue, replacing the pi session spike
 * (`pi-session.test.mjs`). The behaviour under test is the same one that spike
 * proved for pi — a run executes our tool, streams its text, round-trips the
 * tool result to the provider, and a second submission on the SAME conversation
 * replays the earlier turns instead of starting blank — expressed through
 * `init()` / `dispatch()` / `read()` on the agent runtime.
 */

// `MagicSyncAgent` imports the planner, which reaches the DB service layer, so
// the layer's stubbed drizzle needs the test database in place.
let cleanupDb
before(async () => { cleanupDb = (await initTestDb()).cleanup })
after(async () => { await cleanupDb?.() })

const TOOL = 'echo_note'

const echoNote = defineTool({
  name: TOOL,
  description: 'Echo a note back to the model.',
  input: v.object({ note: v.pipe(v.string(), v.description('Note to echo')) }),
  run: async toolCtx => ({ output: `note: ${toolCtx.data.note}` }),
})

test('a Flue conversation runs our tool, streams, and keeps its transcript', async (t) => {
  const stub = await startStubProvider({ toolName: TOOL, toolArgs: { note: 'hello from stub' }, finalText: 'Stub finished the task.' })
  const { registerBusinessProvider, stopFlueRuntime } = await import('../server/flue/runtime.ts')
  const { bindAgentConversation, releaseAgentConversation } = await import('../server/flue/agent-bindings.ts')
  const { MagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
  t.after(async () => {
    await stopFlueRuntime()
    await stub.close()
  })

  const registration = registerBusinessProvider({
    businessId: 'flue-conversation',
    provider: 'stub',
    model: 'stub-model',
    apiKey: 'stub-key',
    apiBaseUrl: stub.url,
  })
  await (await import('../server/flue/runtime.ts')).getFlueRuntime({ agents: [MagicSyncAgent] })

  const conversationId = 'flue-conversation-1'
  bindAgentConversation(conversationId, {
    model: registration.modelSpecifier,
    instructions: 'Call echo_note once, then answer in one short sentence.',
    tools: [echoNote],
  })
  t.after(() => releaseAgentConversation(conversationId))

  const handle = init(MagicSyncAgent, { id: conversationId })
  const chunks = []
  const receipt = await handle.dispatch({ message: 'Run the echo tool for me.' })
  const reply = await handle.read(receipt, { onEvent: chunk => chunks.push(chunk) })

  assert.equal(reply.text.trim(), stub.finalText, 'streamed text deltas match the final text')
  assert.ok(chunks.some(chunk => chunk.type === 'tool-input' && chunk.toolName === TOOL), 'our tool ran once')
  assert.ok(!chunks.some(chunk => chunk.type === 'tool-output-error'), 'the tool succeeded')
  assert.equal(stub.requests.length, 2, 'the stub saw a tool turn and a text turn')
  assert.equal(stub.requests[1].model, 'stub-model')
  assert.ok(
    stub.requests[1].messages.some(message => message.role === 'tool' && JSON.stringify(message).includes('note: hello from stub')),
    'the tool result round-tripped to the provider',
  )
  assert.deepEqual(stub.authorizations, ['Bearer stub-key', 'Bearer stub-key'], 'this business key rode both turns')

  // The conversation is addressable after the run settled, and a second
  // submission replays the first turn's chunks before its own.
  const instance = await getAgentInstance(MagicSyncAgent, conversationId)
  assert.equal(instance.id, conversationId)

  const secondChunks = []
  const second = await handle.dispatch({ message: 'And once more.' })
  const secondReply = await handle.read(second, { onEvent: chunk => secondChunks.push(chunk) })
  assert.equal(secondReply.text.trim(), stub.finalText)
  const replayedTools = secondChunks.filter(chunk => chunk.type === 'tool-input')
  assert.equal(replayedTools.length, 1, 'the first turn\'s tool call is replayed to the reader')
  assert.ok(secondChunks.some(chunk => chunk.type === 'message-delta'), 'the new turn streams its own text')
  assert.equal(secondChunks[secondChunks.length - 1].type, 'submission-settled')
})

test('an unbound conversation renders the deployment default agent', async (t) => {
  const stub = await startStubProvider({ finalText: 'Default agent answered.' })
  const { registerBusinessProvider, getFlueRuntime, stopFlueRuntime } = await import('../server/flue/runtime.ts')
  const { MagicSyncAgent } = await import('../server/flue/magicsync-agent.ts')
  t.after(async () => {
    await stopFlueRuntime()
    await stub.close()
  })

  registerBusinessProvider({
    businessId: 'flue-unbound',
    provider: 'stub',
    model: 'stub-model',
    apiKey: 'stub-key',
    apiBaseUrl: stub.url,
  })
  await getFlueRuntime({ agents: [MagicSyncAgent] })

  // No binding: the deployment defaults decide the model, and the agent offers
  // only `plan_lookup` — the T25 HTTP mount's path. `stub/stub-model` is not a
  // registered provider id (businesses register under a scoped id), so the
  // submission fails at init and never reaches a network call.
  const handle = init(MagicSyncAgent, { id: 'flue-unbound-1' })
  const receipt = await handle.dispatch({ message: 'hello' })
  await assert.rejects(
    () => handle.read(receipt),
    (error) => {
      assert.equal(error.name, 'AgentRunError')
      return true
    },
    'the unbound render cannot resolve a deployment-default model here',
  )
})

test('bindings are per conversation and released with the run', async () => {
  const { bindAgentConversation, releaseAgentConversation, agentBinding, boundConversationIds } = await import('../server/flue/agent-bindings.ts')

  bindAgentConversation('conv-a', { model: 'stub/stub-model', instructions: 'a', tools: [] })
  bindAgentConversation('conv-b', { model: 'stub/stub-model', instructions: 'b', tools: [] })
  assert.equal(agentBinding('conv-a').instructions, 'a')
  assert.equal(agentBinding('conv-missing'), undefined, 'an unbound id resolves nothing')
  assert.deepEqual(boundConversationIds().sort(), ['conv-a', 'conv-b'])

  releaseAgentConversation('conv-a')
  assert.equal(agentBinding('conv-a'), undefined)
  assert.equal(agentBinding('conv-b').instructions, 'b', 'one run never unbinds another run')
})
