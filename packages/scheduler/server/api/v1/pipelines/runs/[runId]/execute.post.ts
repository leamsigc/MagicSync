import type { H3Event } from 'h3'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { completeForUser } from '#layers/BaseAgent/server/utils/run-config'
import type { PipelineStatus, PipelineStep } from '#layers/BaseDB/db/schema'

const EXECUTABLE = new Set(['running', 'waiting_input'])

function parseSteps(raw: string | null): PipelineStep[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PipelineStep[] : []
  } catch {
    return []
  }
}

function parseResults(raw: string | null): unknown[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseRunInput(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function nextStatus(steps: PipelineStep[], index: number): PipelineStatus {
  if (steps.length === 0 || index >= steps.length - 1) {
    return 'completed'
  }
  if (steps[index + 1]?.type === 'llm_human_input') {
    return 'waiting_input'
  }
  return 'running'
}

async function loadExecutableRun(runId: string, userId: string, event: H3Event) {
  const run = await pipelineService.getRun(runId, userId, event)
  if (!run.success || !run.data) {
    throw createError({ statusCode: 404, statusMessage: 'Pipeline run not found' })
  }
  if (!EXECUTABLE.has(run.data.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Only running or waiting runs can be executed' })
  }
  return run.data
}

async function loadBrandContext(
  input: Record<string, unknown>,
  businessId: string,
  userId: string,
  event: H3Event,
): Promise<{ prompt: string, editionId: string | null, enabled: boolean }> {
  const result = await businessContextResolver.resolve(userId, {
    businessId,
    useBusinessContext: input.useBusinessContext === true,
  }, event)
  if (!result.success || !result.data) {
    throw createError({ statusCode: contextErrorStatus(result.code), message: result.error })
  }
  const context = result.data
  return { prompt: context.prompt, editionId: context.editionId, enabled: context.enabled }
}

async function executeStep(
  event: H3Event,
  userId: string,
  businessId: string,
  brandPrompt: string,
  input: Record<string, unknown>,
  step: PipelineStep | undefined,
  prior: unknown[],
) {
  const result = await completeForUser(userId, {
    businessId,
    useBusinessContext: false,
    event,
    system: brandPrompt || undefined,
    maxTokens: 1600,
    prompt: [
      step?.prompt || `Execute pipeline step "${step?.name ?? 'step'}" (${step?.type ?? 'llm_single'}).`,
      `Brief: ${String(input.brief ?? '')}`,
      `Previous outputs: ${JSON.stringify(prior).slice(0, 4000)}`,
    ].join('\n'),
  })
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error })
  }
  return {
    phase: 0,
    phase_name: step?.name,
    phase_type: step?.type,
    result: { text: result.data.text },
  }
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const runId = getRouterParam(event, 'runId')
    if (!runId) {
      throw createError({ statusCode: 400, statusMessage: 'runId is required' })
    }

    const stored = await loadExecutableRun(runId, user.id, event)
    const pipeline = await pipelineService.getPipeline(stored.pipelineId, user.id, event)
    const steps = pipeline.success && pipeline.data ? parseSteps(pipeline.data.steps) : []
    const index = stored.currentStep
    const step = steps[index]
    const prior = parseResults(stored.stepResults)

    const input = parseRunInput(stored.input)
    const brand = await loadBrandContext(input, stored.businessId, user.id, event)

    const executed = await executeStep(event, user.id, stored.businessId, brand.enabled ? brand.prompt : '', input, step, prior)

    const entry = {
      step: index,
      name: executed.phase_name ?? step?.name ?? `Step ${index + 1}`,
      type: executed.phase_type ?? step?.type ?? 'llm_single',
      output: executed.result ?? null,
      at: new Date().toISOString(),
    }
    const status = nextStatus(steps, index)
    const recorded = await pipelineService.recordExecution(runId, user.id, {
      status,
      stepResults: [...prior, entry],
      agentName: entry.name,
      summary: `Step ${index + 1} executed (${entry.type})`,
    }, event)
    if (!recorded.success) {
      throw createError({ statusCode: 500, statusMessage: recorded.error || 'Failed to record execution' })
    }

    log.info({ message: 'Pipeline step executed', runId, step: index, status })
    return recorded
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    log.error({ content: 'Execute pipeline step error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
