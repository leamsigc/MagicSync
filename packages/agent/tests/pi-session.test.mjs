import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createAgentSession, defineTool, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import { applyRunApiKey, createAgentModelRuntime, resolveRunModel } from '../server/utils/pi-runtime.ts'
import { startStubProvider } from './stub-provider.mjs'

const STUB_TOOL = 'echo_note'

function writeStubModelsConfig(dir, baseUrl) {
  const modelsPath = join(dir, 'models.json')
  writeFileSync(modelsPath, JSON.stringify({
    providers: {
      stub: {
        name: 'Stub Provider',
        baseUrl,
        api: 'openai-completions',
        apiKey: 'stub-key',
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
        },
        models: [{
          id: 'stub-model',
          name: 'Stub Model',
          reasoning: false,
          input: ['text'],
          contextWindow: 128000,
          maxTokens: 4096,
        }],
      },
    },
  }, null, 2))
  return modelsPath
}

function collectAssistantText(messages) {
  return messages
    .filter(message => message.role === 'assistant')
    .flatMap(message => message.content)
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim()
}

test('pi session runs a custom tool and restores from persisted entries', async (t) => {
  const stub = await startStubProvider({ toolName: STUB_TOOL, finalText: 'Stub finished the task.' })
  const dir = mkdtempSync(join(tmpdir(), 'pi-spike-'))
  t.after(async () => {
    await stub.close()
    rmSync(dir, { recursive: true, force: true })
  })

  const cwd = join(dir, 'workspace')
  const agentDir = join(dir, 'agent')
  mkdirSync(cwd, { recursive: true })
  mkdirSync(agentDir, { recursive: true })

  const modelsPath = writeStubModelsConfig(dir, stub.url)
  const runtime = await createAgentModelRuntime({ modelsPath })
  await applyRunApiKey(runtime, 'stub', 'stub-key')
  const model = resolveRunModel(runtime, 'stub', 'stub-model')
  assert.ok(model, 'custom model resolves from models.json')

  const toolCalls = []
  const echoNote = defineTool({
    name: STUB_TOOL,
    label: 'Echo Note',
    description: 'Echo a note back to the model.',
    parameters: Type.Object({ note: Type.String({ description: 'Note to echo' }) }),
    execute: async (toolCallId, params) => {
      toolCalls.push({ toolCallId, note: params.note })
      return { content: [{ type: 'text', text: `note: ${params.note}` }], details: {} }
    },
  })

  const sessionManager = SessionManager.inMemory(cwd, { id: 'spike-session' })
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    model,
    modelRuntime: runtime,
    noTools: 'all',
    tools: [STUB_TOOL],
    excludeTools: ['bash', 'read', 'write', 'edit'],
    customTools: [echoNote],
    sessionManager,
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: false },
    }),
  })

  const toolEnds = []
  const textDeltas = []
  session.subscribe((event) => {
    if (event.type === 'tool_execution_end') toolEnds.push(event)
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      textDeltas.push(event.assistantMessageEvent.delta)
    }
  })

  await session.prompt('Run the echo tool for me.')

  assert.equal(toolCalls.length, 1, 'tool executed once')
  assert.equal(toolCalls[0].note, 'hello from stub')
  assert.equal(toolEnds.length, 1, 'one tool execution ended')
  assert.equal(toolEnds[0].toolName, STUB_TOOL)
  assert.equal(toolEnds[0].isError, false)
  assert.equal(textDeltas.join('').trim(), stub.finalText, 'streamed text deltas match the final text')
  assert.equal(collectAssistantText(session.messages), stub.finalText, 'final assistant text persisted')
  assert.ok(session.getToolDefinition(STUB_TOOL), 'custom tool is registered')
  assert.equal(session.getToolDefinition('bash'), undefined, 'no built-in bash tool reaches the session')

  assert.equal(stub.requests.length, 2, 'stub saw a tool turn and a text turn')
  assert.equal(stub.requests[1].model, 'stub-model')
  assert.ok(
    stub.requests[1].messages.some(message => message.role === 'tool' && JSON.stringify(message).includes('note: hello from stub')),
    'tool result round-tripped to the provider',
  )

  const entries = sessionManager.getEntries()
  assert.ok(entries.some(entry => entry.type === 'message'), 'session entries persisted')
  const restored = SessionManager.inMemory(cwd, { id: 'spike-restored' }, entries)
  const restoredContext = restored.buildSessionContext()
  assert.equal(restoredContext.model?.provider, 'stub')
  assert.equal(restoredContext.messages.length, session.messages.length, 'restored context replays every message')
})
