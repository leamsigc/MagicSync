import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { ExecutableSkill, SkillRunContext } from '../contracts'
import { completeJson } from '../complete-json'
import { promptOf, renderTemplate, roleOf } from '../prompts'
import body from './create-marketing-plan/SKILL.md?raw'

const ActionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
})

const PhaseSchema = z.object({
  name: z.string().min(1),
  focus: z.string().min(1),
  actions: z.array(ActionSchema).min(1),
})

const OutputSchema = z.object({
  planTitle: z.string().min(1),
  summary: z.string().min(1),
  horizon: z.enum(['30d', '90d']).default('30d'),
  phases: z.array(PhaseSchema).min(1).max(6),
})

type MarketingPlanOutput = z.infer<typeof OutputSchema>

const InputSchema = z.object({
  horizon: z.enum(['30d', '90d']).default('30d'),
  focus: z.string().max(300).optional(),
})

function evidenceBlock(previous: Record<string, unknown>): string {
  return Object.entries(previous)
    .map(([stepId, result]) => `## Evidence: ${stepId}\n${JSON.stringify(result).slice(0, 2500)}`)
    .join('\n\n')
}

function promptFor(horizon: string, evidence: string, focus: string, goal: string): string {
  return renderTemplate(promptOf(body), {
    horizon,
    evidence,
    focus: focus ? `Focus on: ${focus}` : '',
    goal,
  })
}

async function run(ctx: SkillRunContext, input: unknown): Promise<ServiceResponse<unknown>> {
  const parsed = InputSchema.safeParse(input ?? {})
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' }
  const completed = await completeJson(ctx, {
    prompt: promptFor(parsed.data.horizon, evidenceBlock(ctx.previous), parsed.data.focus ?? '', ctx.goal),
    schema: OutputSchema,
    system: roleOf(body),
    maxTokens: 2000,
  })
  if (!completed.success) return completed
  return { success: true, data: completed.data }
}

function verify(output: unknown) {
  const parsed = OutputSchema.safeParse(output)
  if (!parsed.success) return { ok: false, reason: 'Output failed schema validation' }
  const allActions = parsed.data.phases.flatMap(phase => phase.actions)
  const vague = allActions.some(action => action.title.trim().length < 8)
  if (vague) return { ok: false, reason: 'A plan action is too vague to execute' }
  return { ok: true }
}

export const createMarketingPlanSkill: ExecutableSkill = {
  id: 'create-marketing-plan',
  name: 'Create marketing plan',
  description: 'Create a sequenced 30-day or 90-day marketing plan with prioritized, concrete actions.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiredContext: ['previous-research'],
  requiredTools: [],
  consequential: false,
  verify,
  run,
}

export type { MarketingPlanOutput }
