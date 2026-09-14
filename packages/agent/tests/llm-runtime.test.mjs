import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startStubProvider } from './stub-provider.mjs'
import { writeStubModelsConfig } from './stub-models.mjs'
import { createAgentModelRuntime, describeRuntimeProviders, testModelConnection } from '../server/utils/pi-runtime.ts'

// T11 — one model path: discovery + connection test through pi ModelRuntime.
let runtime
let stub
let dir

before(async () => {
  stub = await startStubProvider({ toolName: 'echo_note', finalText: 'pong' })
  dir = mkdtempSync(join(tmpdir(), 'agent-llm-'))
  const modelsPath = writeStubModelsConfig(dir, stub.url)
  runtime = await createAgentModelRuntime({ modelsPath })
})

after(async () => {
  await stub.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('pi model config (T11)', () => {
  it('discovers custom and deployment providers', async () => {
    const providers = await describeRuntimeProviders(runtime)
    const stubProvider = providers.find(provider => provider.id === 'stub')
    assert.ok(stubProvider)
    assert.ok(stubProvider.models.includes('stub-model'))
    assert.ok(providers.some(provider => provider.id === 'openai'), 'built-in providers stay discoverable')

    const deployment = await createAgentModelRuntime()
    const deploymentIds = (await describeRuntimeProviders(deployment)).map(provider => provider.id)
    assert.ok(deploymentIds.includes('ollama'))
    assert.ok(deploymentIds.includes('deepseek'))
  })

  it('tests a live connection through the resolved model', async () => {
    const result = await testModelConnection(runtime, {
      provider: 'stub',
      model: 'stub-model',
      apiKey: 'stub-key',
    })
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(typeof result.data.latencyMs, 'number')
    assert.ok(stub.requests.length > 0)
  })

  it('returns a typed error for unknown models', async () => {
    const result = await testModelConnection(runtime, { provider: 'stub', model: 'nope' })
    assert.equal(result.success, false)
    assert.equal(result.code, 'MODEL_NOT_AVAILABLE')
  })
})
