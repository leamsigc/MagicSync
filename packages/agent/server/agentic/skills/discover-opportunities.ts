import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { ExecutableSkill, SkillRunContext } from '../contracts'
import { completeJson } from '../complete-json'
import { promptOf, renderTemplate, roleOf } from '../prompts'
import body from './discover-opportunities/SKILL.md?raw'

const OpportunitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  rationale: z.string().min(1),
  impact: z.enum(['high', 'medium', 'low']),
  effort: z.enum(['high', 'medium', 'low']),
  priority: z.number().int().min(1).max(20),
})

const OutputSchema = z.object({
  summary: z.string().min(1),
  opportunities: z.array(OpportunitySchema).min(1).max(10),
})

type DiscoverOpportunitiesOutput = z.infer<typeof OutputSchema>

const InputSchema = z.object({ focus: z.string().max(300).optional() })

function evidenceBlock(previous: Record<string, unknown>): string {
  return Object.entries(previous)
    .map(([stepId, result]) => `## Evidence: ${stepId}\n${JSON.stringify(result).slice(0, 3000)}`)
    .join('\n\n')
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
  const evidence = evidenceBlock(ctx.previous)
  if (!evidence) {
    return { success: false, error: 'No research evidence is available yet; run research steps first', code: 'RESEARCH_MISSING' }
  }
  const completed = await completeJson(ctx, {
    prompt: promptFor(evidence, parsed.data.focus ?? '', ctx.goal),
    schema: OutputSchema,
    system: roleOf(body),
    maxTokens: 1600,
  })
  if (!completed.success) return completed
  return { success: true, data: completed.data }
}

function verify(output: unknown) {
  const parsed = OutputSchema.safeParse(output)
  if (!parsed.success) return { ok: false, reason: 'Output failed schema validation' }
  const priorities = parsed.data.opportunities.map(opportunity => opportunity.priority)
  const unique = new Set(priorities)
  if (unique.size !== priorities.length) return { ok: false, reason: 'Opportunity priorities are not unique' }
  return { ok: true }
}

export const discoverOpportunitiesSkill: ExecutableSkill = {
  id: 'discover-opportunities',
  name: 'Discover opportunities',
  description: 'Turn research evidence into prioritized, evidence-backed business opportunities.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiredContext: ['previous-research'],
  requiredTools: [],
  consequential: false,
  verify,
  run,
}

export type { DiscoverOpportunitiesOutput }
