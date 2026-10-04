import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defineTool, init, observe, useModel, useTool } from '@flue/runtime'
import {
  buildBusinessProvider,
  FlueProviderConfigError,
  providerRegistryId,
  registerBusinessProvider,
  getFlueRuntime,
  stopFlueRuntime,
} from '../server/flue/runtime.ts'
import { startStubProvider } from './stub-provider.mjs'

/**
 * T26 provider spike (PRD-FLUE-RUNTIME-CONVERGENCE §6.2, decision D1):
 * - The hermetic SSE stub still serves scripted tool calls end-to-end through
 *   the `getFlueRuntime` singleton + `init`/`dispatch`/`read`.
 * - Per-business credentials never leak between tenants: two interleaved runs
 *   built from two different business configs each send their own key on the
 *   wire, and re-registering one business leaves the other untouched.
 * - The model specifier resolves only to a model id the provider declares; a
 *   wrong id throws at submission init, not mid-run.
 */

const MODEL_ID = 'stub-model'
const PLATFORM_PROVIDER = 'ollama'
const DEPLOYMENT_OLLAMA_URL = 'http://127.0.0.1:11434/v1'

const BUSINESS_A = {
  businessId: 'business-a',
  provider: PLATFORM_PROVIDER,
  model: MODEL_ID,
  apiKey: 'test-key-a',
}

const BUSINESS_B = {
  businessId: 'business-b',
  provider: PLATFORM_PROVIDER,
  model: MODEL_ID,
  apiKey: 'test-key-b',
}

/** Inline agent bound to one registration's specifier; mounts one scripted tool. */
function createTenantAgent(registration, toolName, seen) {
  function TenantAgent() {
    useModel(registration.modelSpecifier)
    useTool(defineTool({
      name: toolName,
      description: `Run the ${toolName} step.`,
      run: async () => {
        seen.push(registration.providerId)
        return { output: `${toolName} done` }
      },
    }))
    return `Call ${toolName}, then answer in one short sentence.`
  }
  TenantAgent.agentName = `tenant-${toolName}`
  return TenantAgent
}

async function runAgent(agent, id, message) {
  const handle = init(agent, { id })
  const receipt = await handle.dispatch({ message })
  return handle.read(receipt)
}

afterEach(async () => {
  // Stops the runtime: Flue allows exactly one live runtime per process, and a
  // stopped one can be booted again by the next test.
  await stopFlueRuntime()
})

describe('per-business Flue providers (T26 spike)', () => {
  it('serves a scripted tool call end-to-end through the runtime singleton', async () => {
    const stub = await startStubProvider({
      toolName: 'echo_note',
      toolArgs: {},
      finalText: 'Provider path finished the task.',
    })
    try {
      const registration = registerBusinessProvider({ ...BUSINESS_A, apiBaseUrl: stub.url })
      const toolCalls = []
      const agent = createTenantAgent(registration, 'echo_note', toolCalls)

      // providers: [] boots no built-ins — the registry holds only the
      // `setProvider` registration made above (no network, no ambient keys).
      await getFlueRuntime({ agents: [agent], named: [{ agent, name: 'hermetic' }], providers: [] })

      const reply = await runAgent(agent, 'hermetic-1', 'Please run the note step.')

      assert.equal(reply.text.trim(), stub.finalText, 'the stub script is returned verbatim')
      assert.deepEqual(toolCalls, [registration.providerId], 'the mounted tool ran once, under its own provider')
      assert.equal(stub.requests.length, 2, 'one tool turn plus one text turn')
      assert.deepEqual(
        stub.authorizations,
        ['Bearer test-key-a', 'Bearer test-key-a'],
        'both turns carried this business key',
      )
      assert.ok(
        stub.requests[1].messages.some(message => message.role === 'tool' && JSON.stringify(message).includes('echo_note done')),
        'the tool result round-tripped back to the provider',
      )
    }
    finally {
      await stub.close()
    }
  })

  it('never leaks one business credential into another tenant run', async () => {
    const stubA = await startStubProvider({ toolName: 'step_a', toolArgs: {}, finalText: 'Tenant A finished.' })
    const stubB = await startStubProvider({ toolName: 'step_b', toolArgs: {}, finalText: 'Tenant B finished.' })
    try {
      const registrationA = registerBusinessProvider({ ...BUSINESS_A, apiBaseUrl: stubA.url })
      const registrationB = registerBusinessProvider({ ...BUSINESS_B, apiBaseUrl: stubB.url })

      const toolCalls = []
      const agentA = createTenantAgent(registrationA, 'step_a', toolCalls)
      const agentB = createTenantAgent(registrationB, 'step_b', toolCalls)
      await getFlueRuntime({
        agents: [agentA, agentB],
        named: [{ agent: agentA, name: 'tenant-a' }, { agent: agentB, name: 'tenant-b' }],
        providers: [],
      })

      // Interleaved: both submissions are in flight at once, exactly the window
      // where a shared registry entry would hand one tenant the other's key.
      const [replyA, replyB] = await Promise.all([
        runAgent(agentA, 'iso-a', 'Tenant A work.'),
        runAgent(agentB, 'iso-b', 'Tenant B work.'),
      ])

      assert.ok(stubA.authorizations.length >= 1 && stubB.authorizations.length >= 1, 'both tenants reached the wire')
      assert.deepEqual([...new Set(stubA.authorizations)], ['Bearer test-key-a'], 'tenant A only ever sent its own key')
      assert.deepEqual([...new Set(stubB.authorizations)], ['Bearer test-key-b'], 'tenant B only ever sent its own key')
      assert.equal(stubA.authorizations.includes('Bearer test-key-b'), false, 'tenant B key never reached tenant A')
      assert.equal(stubB.authorizations.includes('Bearer test-key-a'), false, 'tenant A key never reached tenant B')
      assert.equal(replyA.text.trim(), stubA.finalText, 'run A answered from its own provider')
      assert.equal(replyB.text.trim(), stubB.finalText, 'run B answered from its own provider')
      assert.deepEqual(toolCalls.sort(), [registrationA.providerId, registrationB.providerId].sort(), 'each tenant tool ran under its own provider')

      assert.notEqual(registrationA.providerId, registrationB.providerId, 'tenants get distinct registry keys')
      assert.notEqual(registrationA.providerId, PLATFORM_PROVIDER, 'a tenant never registers under the shared provider id')

      // Rotating one tenant's credential must not disturb the other's entry.
      const rotatedB = registerBusinessProvider({ ...BUSINESS_B, apiBaseUrl: stubB.url, apiKey: 'test-key-b2' })
      assert.equal(rotatedB.providerId, registrationB.providerId, 'a re-registration reuses the same tenant key')
      assert.equal(await registrationA.provider.auth.apiKey.resolve({}).then(auth => auth.auth.apiKey), 'test-key-a', 'tenant A still resolves its own key')
      assert.equal(await rotatedB.provider.auth.apiKey.resolve({}).then(auth => auth.auth.apiKey), 'test-key-b2', 'tenant B resolves the rotated key')

      const [afterA] = await Promise.all([runAgent(agentA, 'iso-a-2', 'Tenant A again.')])
      assert.equal(afterA.text.trim(), stubA.finalText, 'tenant A still runs after the other tenant rotated')
      assert.deepEqual([...new Set(stubA.authorizations)], ['Bearer test-key-a'], 'the rotation did not change tenant A on the wire')
    }
    finally {
      await Promise.all([stubA.close(), stubB.close()])
    }
  })

  it('resolves the model specifier to a model the provider declares', async () => {
    const registration = buildBusinessProvider({ ...BUSINESS_A, apiBaseUrl: 'https://gateway.example/v1' })
    assert.equal(registration.modelId, MODEL_ID, 'the registration carries the model id')
    assert.equal(registration.modelSpecifier, `${registration.providerId}/${MODEL_ID}`, 'the specifier is provider-id/model-id')
    assert.deepEqual(
      registration.provider.getModels().map(model => model.id),
      ['llama3.1:8b', 'qwen2.5:7b', MODEL_ID],
      'the provider declares the deployment catalog plus the business model',
    )

    const stub = await startStubProvider({ toolName: 'echo_note', toolArgs: {}, finalText: 'Declared model ran.' })
    try {
      const served = registerBusinessProvider({ ...BUSINESS_A, apiBaseUrl: stub.url })
      assert.equal(served.modelSpecifier, registration.modelSpecifier, 'the registry key is stable per business')
      const toolCalls = []
      const agent = createTenantAgent(served, 'echo_note', toolCalls)
      await getFlueRuntime({ agents: [agent], named: [{ agent, name: 'declared' }], providers: [] })
      const reply = await runAgent(agent, 'declared-1', 'Use the declared model.')
      assert.equal(reply.text.trim(), stub.finalText, 'the declared model id resolves and serves the run')
    }
    finally {
      await stub.close()
    }
  })

  it('rejects an undeclared model id at submission init', async () => {
    const stub = await startStubProvider({ toolName: 'echo_note', toolArgs: {}, finalText: 'never reached' })
    const events = []
    const stopObserving = observe(event => events.push(event))
    try {
      const registration = registerBusinessProvider({ ...BUSINESS_A, apiBaseUrl: stub.url })

      function UnknownModelAgent() {
        useModel(`${registration.providerId}/not-a-declared-model`)
        return 'Answer briefly.'
      }
      UnknownModelAgent.agentName = 'unknown-model'
      await getFlueRuntime({ agents: [UnknownModelAgent], named: [{ agent: UnknownModelAgent, name: 'unknown' }], providers: [] })

      await assert.rejects(
        () => runAgent(UnknownModelAgent, 'unknown-1', 'This model does not exist.'),
        (error) => {
          assert.equal(error.name, 'AgentRunError', 'the run fails through Flue\'s run error')
          return true
        },
        'an undeclared model id fails the submission',
      )
      assert.equal(stub.requests.length, 0, 'the rejected submission never reached the provider')
      assert.equal(
        events.some(event => event.type === 'turn_request'),
        false,
        'no model turn was ever assembled — the failure happened at submission init',
      )
      const settled = events.find(event => event.type === 'submission_settled')
      assert.equal(settled?.outcome, 'failed', 'the submission settles as failed, not as a mid-run interruption')
    }
    finally {
      stopObserving()
      await stub.close()
    }
  })

  it('drains a displaced runtime instead of booting a second one', async () => {
    const stub = await startStubProvider({ toolName: 'echo_note', toolArgs: {}, finalText: 'Rebooted runtime ran.' })
    try {
      const first = registerBusinessProvider({ ...BUSINESS_A, apiBaseUrl: stub.url })
      const toolCalls = []
      const agent = createTenantAgent(first, 'echo_note', toolCalls)
      await getFlueRuntime({ agents: [agent], named: [{ agent, name: 'boot-1' }], providers: [] })

      // A different agent set changes the singleton key: the live runtime must be
      // drained first, because Flue refuses to start a second one.
      const second = registerBusinessProvider({ ...BUSINESS_B, apiBaseUrl: stub.url })
      const nextAgent = createTenantAgent(second, 'echo_note', toolCalls)
      const rebooted = await getFlueRuntime({ agents: [nextAgent], named: [{ agent: nextAgent, name: 'boot-2' }], providers: [] })
      assert.ok(rebooted, 'the runtime re-boots with the new option set')

      const reply = await runAgent(nextAgent, 'reboot-1', 'Run after the reboot.')
      assert.equal(reply.text.trim(), stub.finalText, 'the re-booted runtime serves the run')
    }
    finally {
      await stub.close()
    }
  })

  it('covers the repository provider families and their base URLs', async () => {
    const ollama = buildBusinessProvider({ businessId: 'fam-1', provider: 'ollama', model: 'llama3.1:8b' })
    assert.equal(ollama.provider.getModels()[0].baseUrl, DEPLOYMENT_OLLAMA_URL, 'ollama falls back to the deployment base URL')
    assert.deepEqual(
      ollama.provider.getModels()[0].compat,
      { supportsDeveloperRole: false, supportsReasoningEffort: false },
      'the deployment catalog wire-compatibility overrides ride along',
    )

    const llama = buildBusinessProvider({ businessId: 'fam-2', provider: 'llama', model: 'custom:model' })
    assert.deepEqual(
      llama.provider.getModels().map(model => model.id),
      ['prism-ml/Ternary-Bonsai-2-27B-gguf:Q2_0', 'custom:model'],
      'a dynamic local provider declares the ad-hoc id alongside the catalog',
    )

    const deepseek = buildBusinessProvider({ businessId: 'fam-3', provider: 'deepseek', model: 'deepseek-reasoner', apiKey: 'test-key-ds' })
    assert.deepEqual(
      deepseek.provider.getModels().map(model => model.reasoning),
      [false, true],
      'catalog reasoning metadata survives the per-business build',
    )

    const openrouter = buildBusinessProvider({
      businessId: 'fam-4',
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b',
      apiKey: 'test-key-or',
    })
    assert.ok(
      openrouter.modelSpecifier.endsWith('/meta-llama/llama-3.3-70b'),
      'a gateway model id outside the bundled template is declared and resolvable',
    )

    const custom = buildBusinessProvider({
      businessId: 'fam-5',
      provider: 'acme-gateway',
      model: 'acme-large',
      apiBaseUrl: ' https://acme.example/v1 ',
      apiKey: ' test-key-custom ',
    })
    assert.equal(custom.provider.getModels()[0].baseUrl, 'https://acme.example/v1', 'a custom base URL is trimmed and used verbatim')
    assert.equal(await custom.provider.auth.apiKey.resolve({}).then(auth => auth.auth.apiKey), 'test-key-custom', 'the key is trimmed and captured in the closure')

    const keyless = buildBusinessProvider({ businessId: 'fam-6', provider: 'ollama', model: 'local-only:7b' })
    assert.equal(keyless.keyless, true, 'a local placeholder key is not a real credential')
    assert.equal(
      await keyless.provider.auth.apiKey.resolve({}).then(auth => auth.auth.apiKey),
      'ollama',
      'a local server still gets the catalog placeholder — several OpenAI-compatible local servers reject a request with no Authorization header at all',
    )

    const platform = buildBusinessProvider({ businessId: null, provider: PLATFORM_PROVIDER, model: MODEL_ID, apiKey: 'test-key-platform' })
    assert.equal(platform.providerId, PLATFORM_PROVIDER, 'the platform default keeps the plain provider id')
    assert.equal(providerRegistryId({ businessId: null, provider: PLATFORM_PROVIDER }), PLATFORM_PROVIDER, 'no business id means no scoping')

    assert.throws(
      () => buildBusinessProvider({ businessId: 'fam-7', provider: 'acme-gateway', model: 'acme-large' }),
      (error) => {
        assert.ok(error instanceof FlueProviderConfigError, 'a missing base URL is a config error')
        assert.equal(error.code, 'MODEL_NOT_CONFIGURED', 'the error carries the coded convention')
        return true
      },
      'a provider with no base URL anywhere is rejected',
    )
  })
})