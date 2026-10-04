import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import type { ExecutableSkill, SkillRunContext } from '../contracts'
import { completeJson } from '../complete-json'
import { promptOf, renderTemplate, roleOf } from '../prompts'
import body from './research-business/SKILL.md?raw'

const OutputSchema = z.object({
  summary: z.string().min(1),
  keyFacts: z.array(z.string()).min(1),
  audience: z.string().default(''),
  offers: z.array(z.string()).default([]),
})

type ResearchBusinessOutput = z.infer<typeof OutputSchema>

const InputSchema = z.object({ focus: z.string().max(300).optional() })

function businessNotFound(): ServiceResponse<never> {
  return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
}

function promptFor(name: string, category: string, description: string, address: string, focus: string): string {
  return renderTemplate(promptOf(body), {
    name,
    category,
    address,
    description: description.slice(0, 800),
    focus: focus ? `Focus on: ${focus}.` : '',
  })
}

async function run(ctx: SkillRunContext, input: unknown): Promise<ServiceResponse<unknown>> {
  const parsed = InputSchema.safeParse(input ?? {})
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' }
  const profile = await businessProfileService.findById(ctx.businessId, ctx.userId, ctx.event)
  if (!profile.success || !profile.data) return businessNotFound()
  const completed = await completeJson(ctx, {
    prompt: promptFor(profile.data.name, profile.data.category ?? '', profile.data.description ?? '', profile.data.address ?? '', parsed.data.focus ?? ''),
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
  if (parsed.data.keyFacts.length < 2) return { ok: false, reason: 'Business snapshot has too few facts' }
  return { ok: true }
}

export const researchBusinessSkill: ExecutableSkill = {
  id: 'research-business',
  name: 'Research business',
  description: 'Build a factual snapshot of the business: summary, key facts, audience, offers.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiredContext: ['business-profile'],
  requiredTools: [],
  consequential: false,
  verify,
  run,
}

export type { ResearchBusinessOutput }
