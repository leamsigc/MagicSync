import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { ExecutableSkill, SkillRunContext } from '../contracts'
import { completeJson } from '../complete-json'
import { promptOf, renderTemplate, roleOf } from '../prompts'
import { resolveLangSearchKey, searchLangSearch, type LangSearchResult } from '../../utils/langsearch'
import body from './research-competitors/SKILL.md?raw'

const CompetitorSchema = z.object({
  name: z.string().min(1),
  positioning: z.string().default(''),
  evidence: z.string().default(''),
})

const OutputSchema = z.object({
  summary: z.string().min(1),
  competitors: z.array(CompetitorSchema).min(1),
  sources: z.array(z.object({ label: z.string().min(1), url: z.string().optional() })).min(1),
})

type ResearchCompetitorsOutput = z.infer<typeof OutputSchema>

const InputSchema = z.object({
  topic: z.string().max(300).optional(),
  maxResults: z.number().int().min(1).max(10).optional(),
})

function searchQueryFor(topic: string): string {
  return `competitors of ${topic} local market reviews pricing`
}

function evidenceFor(results: LangSearchResult[]): string {
  return results
    .slice(0, 8)
    .map(result => `- ${result.title} (${result.url}): ${result.text.slice(0, 600)}`)
    .join('\n')
}

function promptFor(topic: string, evidence: string): string {
  return renderTemplate(promptOf(body), { topic, evidence })
}

async function resolveKey(ctx: SkillRunContext): Promise<string | null> {
  if (ctx.langsearchKey !== undefined) return ctx.langsearchKey
  const resolved = await resolveLangSearchKey(ctx.userId)
  return resolved.success ? resolved.data : null
}

async function run(ctx: SkillRunContext, input: unknown): Promise<ServiceResponse<unknown>> {
  const parsed = InputSchema.safeParse(input ?? {})
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' }
  const key = await resolveKey(ctx)
  if (!key) {
    return { success: false, error: 'LangSearch is not configured. Add an API key in AI settings or set LANGSEARCH_API_KEY.', code: 'LANGSEARCH_NOT_CONFIGURED' }
  }
  const topic = parsed.data.topic ?? ctx.goal
  const search = await (ctx.langsearch ?? searchLangSearch)({
    query: searchQueryFor(topic),
    count: parsed.data.maxResults ?? 6,
    fullText: { maxCharacters: 2000 },
  }, key)
  if (!search.success) return { success: false, error: search.error, code: search.code ?? 'LANGSEARCH_FAILED' }
  const results = search.data.results
  if (results.length === 0) {
    return { success: false, error: 'No competitor sources found for this market', code: 'RESEARCH_EMPTY' }
  }
  const completed = await completeJson(ctx, {
    prompt: promptFor(topic, evidenceFor(results)),
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
  const missingEvidence = parsed.data.competitors.some(competitor => competitor.evidence.trim().length === 0)
  if (missingEvidence) return { ok: false, reason: 'A competitor finding has no evidence' }
  if (parsed.data.sources.length === 0) return { ok: false, reason: 'No sources returned' }
  return { ok: true }
}

export const researchCompetitorsSkill: ExecutableSkill = {
  id: 'research-competitors',
  name: 'Research competitors',
  description: 'Research competitors for a business and return evidence-backed competitor findings with source URLs.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiredContext: ['business-profile'],
  requiredTools: ['web_search'],
  consequential: false,
  verify,
  run,
}

export type { ResearchCompetitorsOutput }
