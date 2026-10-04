import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { contentChainService } from '../../services/content-chain.service'
import { createContentIntelligence, type ContentIntelligence, type GenerateIdeasRequest, type ResearchCallResult } from '../../content-intelligence'
import type { RunConfig } from '../../utils/run-config'
import type { ExecutableSkill, SkillRunContext } from '../contracts'

const InputSchema = z.object({
  topic: z.string().max(300).optional(),
  quantity: z.number().int().min(1).max(31).optional(),
  platforms: z.array(z.string().min(1).max(40)).max(12).optional(),
})

const OutputSchema = z.object({
  research: z.unknown(),
  ideas: z.array(z.object({
    title: z.string().min(1),
    brief: z.string(),
    platforms: z.array(z.string()),
    platformDetails: z.record(z.string(), z.unknown()).default({}),
  })).min(1),
  metadata: z.record(z.string(), z.unknown()),
})

type ContentIdeasOutput = z.infer<typeof OutputSchema>

/**
 * The intelligence module expects the richer RunConfig shape; a goal run only
 * carries the completion function + system context it actually consumes.
 */
function runConfigFor(ctx: SkillRunContext): RunConfig {
  const partial: Partial<RunConfig> = {
    runtime: null,
    model: null,
    provider: '',
    modelId: '',
    apiKey: null,
    apiBaseUrl: null,
    systemContext: ctx.systemContext,
    complete: ctx.complete,
  }
  return partial as RunConfig
}

function researchCall(ctx: SkillRunContext) {
  return async (input: { userId: string, businessId: string, topic: string, run: RunConfig }): Promise<ServiceResponse<ResearchCallResult>> => {
    const result = await contentChainService.researchTopic({
      userId: input.userId,
      businessId: input.businessId,
      complete: ctx.complete,
      event: ctx.event,
    }, { topic: input.topic })
    if (!result.success) return { success: false, error: result.error, code: result.code ?? 'RESEARCH_FAILED' }
    return {
      success: true,
      data: {
        brief: result.data.brief,
        citations: result.data.citations,
        sourcesUsed: result.data.citations.filter(citation => citation.url).length,
        usedAgent: false,
      },
    }
  }
}

function intelligenceFor(ctx: SkillRunContext): ContentIntelligence {
  return createContentIntelligence({
    research: researchCall(ctx),
    complete: ctx.complete,
  })
}

async function run(ctx: SkillRunContext, input: unknown): Promise<ServiceResponse<unknown>> {
  const parsed = InputSchema.safeParse(input ?? {})
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' }
  const intelligence = intelligenceFor(ctx)
  const request: GenerateIdeasRequest = {
    userId: ctx.userId,
    businessId: ctx.businessId,
    topic: parsed.data.topic ?? ctx.goal.slice(0, 300),
    quantity: parsed.data.quantity ?? 10,
    platforms: parsed.data.platforms ?? ['facebook'],
    run: runConfigFor(ctx),
    event: ctx.event,
    log: ctx.log,
  }
  const generated = await intelligence.generateContentIdeas(request)
  if (!generated.success) return { success: false, error: generated.error, code: generated.code ?? 'SKILL_FAILED' }
  return { success: true, data: generated.data }
}

function verify(output: unknown) {
  const parsed = OutputSchema.safeParse(output)
  if (!parsed.success) return { ok: false, reason: 'Output failed schema validation' }
  const malformed = parsed.data.ideas.some(idea => idea.title.trim().length === 0)
  if (malformed) return { ok: false, reason: 'An idea is missing its title' }
  return { ok: true }
}

export const createContentIdeasSkill: ExecutableSkill = {
  id: 'create-content-ideas',
  name: 'Create content ideas',
  description: 'Generate research-grounded, platform-aware content ideas for a topic and platform.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiredContext: ['business-profile'],
  requiredTools: ['web_search', 'research_topic'],
  consequential: false,
  verify,
  run,
}

export type { ContentIdeasOutput }
