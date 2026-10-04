import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applyRunBaseUrl,
  createAgentModelRuntime,
  materializeDeploymentModelsPath,
  registerRuntimeModel,
  resolveDeploymentModelsPath,
  resolveEffectiveModelsPath,
  resolveRunModel,
} from '../server/utils/pi-runtime.ts'

// Regression: in Nitro (.nuxt dev / .output prod) import.meta.url no longer
// points at the source tree, so the relative models.json template is missing
// and pi silently loads an empty catalog (llama/ollama vanish with
// MODEL_NOT_AVAILABLE). The template is bundled via ?raw as fallback.
describe('deployment models catalog (Nitro-safe)', () => {
  it('materializes a loadable bundled template', async () => {
    const path = materializeDeploymentModelsPath()
    assert.ok(existsSync(path), 'materialized file exists')
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    assert.ok(parsed.providers?.llama, 'bundled template carries the llama provider')

    const runtime = await createAgentModelRuntime({ modelsPath: path })
    assert.equal(runtime.getError(), undefined, 'materialized catalog parses cleanly')
    const model = resolveRunModel(runtime, 'llama', 'prism-ml/Ternary-Bonsai-2-27B-gguf:Q2_0')
    assert.ok(model, 'llama deployment model resolves from the materialized catalog')
  })

  it('prefers the source template when reachable', () => {
    assert.ok(resolveDeploymentModelsPath().endsWith('server/agent/models.json'))
    assert.equal(resolveEffectiveModelsPath(), resolveDeploymentModelsPath())
  })

  it('registers ad-hoc local models without a models.json entry', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agent-empty-models-'))
    const modelsPath = join(dir, 'models.json')
    writeFileSync(modelsPath, JSON.stringify({ providers: {} }))
    const runtime = await createAgentModelRuntime({ modelsPath })

    assert.equal(resolveRunModel(runtime, 'llama', 'custom:model'), undefined)
    applyRunBaseUrl(runtime, 'llama', 'http://127.0.0.1:1/v1')
    assert.equal(registerRuntimeModel(runtime, 'llama', 'custom:model'), true)
    assert.ok(resolveRunModel(runtime, 'llama', 'custom:model'), 'ad-hoc model resolves after registration')
  })
})
