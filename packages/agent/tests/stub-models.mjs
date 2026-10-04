import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Writes an OpenAI-compatible custom-provider models.json for the SSE stub. */
export function writeStubModelsConfig(dir, baseUrl) {
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
