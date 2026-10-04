import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { ExecutableSkill, SkillRunContext } from '../contracts'
import { completeJson } from '../complete-json'
import { promptOf, renderTemplate, roleOf } from '../prompts'
import type { ResearchBusinessOutput } from './research-business'
import body from './analyze-business/SKILL.md?raw'

const OutputSchema = z.object({
  analysis: z.string().min(1),
  strengths: z.array(z.string()).min(1),
  gaps: z.array(z.string()).default([]),
  opportunityHypotheses: z.array(z.string()).default([]),
})

const InputSchema = z.object({ focus: z.string().max(300).optional() })

type AnalyzeBusinessOutput = z.infer<typeof OutputSchema>

function previousBlock(previous: Record<string, unknown>): string {
  const research = previous['research-business'] as ResearchBusinessOutput | undefined
  if (!research?.summary) return ''
  return [
    'Business snapshot from earlier research:',
    `Summary: ${research.summary}`,
    `Key facts: ${research.keyFacts.join('; ')}`,
    research.audience ? `Audience: ${research.audience}` : '',
  ].filter(Boolean).join('\n')
}

function promptFor(evidence: string, focus: string, goal: string): string {
  return renderTemplate(promptOf(body), {
    evidence,
    focus: focus ? `Focus on: ${focus}` : '',
    goal,
  })
}

async function run(ctx: SkillRunContext, input: unknown): Promise<ServiceResponse<unknown>> {
  const parsed = InputSchema.safeParse(input ?? {})
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' }
  const completed = await completeJson(ctx, {
    prompt: promptFor(previousBlock(ctx.previous), parsed.data.focus ?? '', ctx.goal),
    schema: OutputSchema,
    system: roleOf(body),
    maxTokens: 1400,
  })
  if (!completed.success) return completed
  return { success: true, data: completed.data }
}

function verify(output: unknown) {
  const parsed = OutputSchema.safeParse(output)
  if (!parsed.success) return { ok: false, reason: 'Output failed schema validation' }
  if (parsed.data.strengths.length === 0) return { ok: false, reason: 'Analysis has no strengths' }
  return { ok: true }
}

export const analyzeBusinessSkill: ExecutableSkill = {
  id: 'analyze-business',
  name: 'Analyze business',
  description: 'Analyze a business from its research snapshot: strengths, gaps, and opportunity hypotheses.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiredContext: ['business-profile'],
  requiredTools: [],
  consequential: false,
  verify,
  run,
}

export type { AnalyzeBusinessOutput }
