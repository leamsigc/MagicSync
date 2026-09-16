import type { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { SkillRunContext } from './contracts'
import { GOAL_REPAIR_TEMPLATE, renderTemplate } from './prompts'
import { extractJsonObject } from '../utils/run-config'

export interface CompleteJsonOptions<T> {
  prompt: string
  schema: z.ZodType<T>
  system?: string
  maxTokens?: number
}

type Attempt<T> = { ok: true, value: T } | { ok: false }

/**
 * One validated model completion with a single schema-repair retry. Skills use
 * this instead of parsing raw model text, so invalid output can never flow
 * into a plan or a result.
 */
export async function completeJson<T>(
  ctx: SkillRunContext,
  options: CompleteJsonOptions<T>,
): Promise<ServiceResponse<T>> {
  if (!ctx.complete) {
    return { success: false, error: 'No model is configured for this run', code: 'MODEL_UNAVAILABLE' }
  }
  const system = [ctx.systemContext, options.system].filter(Boolean).join('\n\n')
  const first = await attempt(ctx, options, system)
  if (first.ok) return { success: true, data: first.value }
  const repaired = await attempt(ctx, { ...options, prompt: repairPrompt(options.prompt) }, system)
  if (repaired.ok) return { success: true, data: repaired.value }
  return { success: false, error: 'Model output did not match the required schema', code: 'SKILL_OUTPUT_INVALID' }
}

async function attempt<T>(ctx: SkillRunContext, options: CompleteJsonOptions<T>, system: string): Promise<Attempt<T>> {
  try {
    const text = await ctx.complete({ system, prompt: options.prompt, maxTokens: options.maxTokens ?? 1600 })
    const json = extractJsonObject(text)
    if (!json) return { ok: false }
    const parsed = options.schema.safeParse(json)
    if (!parsed.success) return { ok: false }
    return { ok: true, value: parsed.data }
  } catch {
    return { ok: false }
  }
}

function repairPrompt(original: string): string {
  return renderTemplate(GOAL_REPAIR_TEMPLATE, { original: original.slice(0, 2000) })
}
