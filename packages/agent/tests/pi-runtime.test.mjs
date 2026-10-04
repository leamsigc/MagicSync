import assert from 'node:assert/strict'
import test from 'node:test'
import { createAgentModelRuntime, resolveDeploymentModelsPath, resolveRunModel } from '../server/utils/pi-runtime.ts'

test('deployment models.json template loads without network', async () => {
  const modelsPath = resolveDeploymentModelsPath()
  assert.ok(modelsPath.endsWith('server/agent/models.json'), 'default models path points at the deployment template')

  const runtime = await createAgentModelRuntime()
  assert.equal(runtime.getError(), undefined, 'models.json parses cleanly')

  const ollama = resolveRunModel(runtime, 'ollama', 'llama3.1:8b')
  assert.ok(ollama, 'ollama custom model resolves')
  assert.equal(ollama.provider, 'ollama')

  const deepseek = resolveRunModel(runtime, 'deepseek', 'deepseek-chat')
  assert.ok(deepseek, 'deepseek model resolves from the template')

  assert.equal(resolveRunModel(runtime, 'ollama', 'not-a-model'), undefined, 'unknown model resolves to undefined')
})
