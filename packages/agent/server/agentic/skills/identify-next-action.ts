import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { ExecutableSkill, SkillRunContext } from '../contracts'
import { completeJson } from '../complete-json'
import { promptOf, renderTemplate, roleOf } from '../prompts'
import body from './identify-next-action/SKILL.md?raw'

const AlternativeSchema = z.object({
  title: z.string().min(1),
  why: z.string().min(1),
})

const OutputSchema = z.object({
  nextAction: z.object({
    title: z.string().min(1).max(200),
    why: z.string().min(1),
    how: z.string().min(1),
  }),
  alternatives: z.array(AlternativeSchema).max(5).default([]),
})

const InputSchema = z.object({})

type NextActionOutput = z.infer<typeof OutputSchema>

function evidenceBlock(previous: Record<string, unknown>): string {
  return Object.entries(previous)
    .map(([stepId, result]) => `## Evidence: ${stepId}\n${JSON.stringify(result).slice(0, 2500)}`)
    .join('\n\n')
}

function promptFor(evidence: string, goal: string): string {
  return renderTemplate(promptOf(body), { evidence, goal })
}

async function run(ctx: SkillRunContext, input: unknown): Promise<ServiceResponse<unknown>> {
  const parsed = InputSchema.safeParse(input ?? {})
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' }
  const completed = await completeJson(ctx, {
    prompt: promptFor(evidenceBlock(ctx.previous), ctx.goal),
    schema: OutputSchema,
    system: roleOf(body),
    maxTokens: 1200,
  })
  if (!completed.success) return completed
  return { success: true, data: completed.data }
}

function verify(output: unknown) {
  const parsed = OutputSchema.safeParse(output)
  if (!parsed.success) return { ok: false, reason: 'Output failed schema validation' }
  if (parsed.data.nextAction.how.trim().length < 10) return { ok: false, reason: 'Next action lacks a how' }
  return { ok: true }
}

export const identifyNextActionSkill: ExecutableSkill = {
  id: 'identify-next-action',
  name: 'Identify next action',
  description: 'Recommend the single highest-value next action for the business owner, with alternatives.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiredContext: ['previous-research'],
  requiredTools: [],
  consequential: false,
  verify,
  run,
}

export type { NextActionOutput }
