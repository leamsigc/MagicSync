import { z } from 'zod'
import { IDEA_PLATFORM_IDS } from '../services/content-chain.service'

const KNOWN_PLATFORMS = new Set(IDEA_PLATFORM_IDS.map(id => id.toLowerCase()))

/** Platform identifiers accepted anywhere ideas are generated (single source: content-chain playbook). */
export const PLATFORM_IDS: string[] = [...KNOWN_PLATFORMS]

function normalizePlatforms(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim().toLowerCase()).filter(value => value.length > 0))]
}

export const ResearchDepthSchema = z.enum(['light', 'standard', 'deep'])

export const GenerateContentIdeasInputSchema = z.object({
  userId: z.string().min(1),
  businessId: z.string().min(1),
  topic: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(31),
  platforms: z.array(z.string().min(1).max(40)).min(1).max(12)
    .transform(normalizePlatforms)
    .refine(ids => ids.every(id => KNOWN_PLATFORMS.has(id)), { message: 'Unsupported platform' }),
  options: z.object({
    researchDepth: ResearchDepthSchema.default('standard'),
    includeBusinessResearch: z.boolean().default(true),
    includeTrends: z.boolean().default(true),
    formatHint: z.string().max(500).optional(),
    research: z.unknown().optional(),
  }).default({}),
})

export type GenerateContentIdeasInput = z.infer<typeof GenerateContentIdeasInputSchema>

export const ResearchSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().optional(),
})

export const ResearchResultSchema = z.object({
  summary: z.string().min(1),
  keyInsights: z.array(z.string()).default([]),
  audienceInsights: z.array(z.string()).default([]),
  businessInsights: z.array(z.string()).default([]),
  trends: z.array(z.string()).default([]),
  contentAngles: z.array(z.string()).default([]),
  sources: z.array(ResearchSourceSchema).default([]),
})

export type ResearchResult = z.infer<typeof ResearchResultSchema>

export const ContentIdeaSchema = z.object({
  title: z.string().min(1).max(140),
  brief: z.string().max(2000).default(''),
  platforms: z.array(z.string().min(1).max(40)).max(12).default([]),
  platformDetails: z.record(z.string(), z.unknown()).default({}),
})

export type ContentIdea = z.infer<typeof ContentIdeaSchema>

export const ContentIdeasResultSchema = z.object({
  research: ResearchResultSchema,
  ideas: z.array(ContentIdeaSchema),
  metadata: z.object({
    requestedQuantity: z.number(),
    generatedQuantity: z.number(),
    platforms: z.array(z.string()),
    tier: z.enum(['llm', 'brief-derived']),
    research: z.object({
      sourcesUsed: z.number(),
      usedAgent: z.boolean(),
      reused: z.boolean(),
    }),
    businessGrounded: z.boolean(),
    durationMs: z.number(),
  }),
})

export type ContentIdeasResult = z.infer<typeof ContentIdeasResultSchema>

/** Normalized title key for duplicate detection (shared with batch merge). */
export function normalizeIdeaTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Drop duplicate/minor-variation ideas, keeping the first of each. */
export function dedupeIdeas<T extends { title: string }>(ideas: T[]): T[] {
  const seen = new Set<string>()
  return ideas.filter((idea) => {
    const key = normalizeIdeaTitle(idea.title)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
