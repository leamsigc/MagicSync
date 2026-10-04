import z from 'zod'

// Typed node-output contracts for the social content pipeline (PRD-SOCIAL-CONTENT-PIPELINE §4).
// Every node emits exactly one kind; the materializer and chat artifacts
// consume these shapes. Kinds mirror the Python DSH runner contract.

export const ResearchResultSchema = z.object({
  outputKind: z.literal('research_result'),
  topic: z.string().default(''),
  angle: z.string().default(''),
  hookOptions: z.array(z.string()).default([]),
  audienceNeed: z.string().default(''),
  evidence: z.array(z.string()).default([]),
  platformNotes: z.record(z.string(), z.string()).default({}),
  warnings: z.array(z.string()).default([]),
})

export type ResearchResult = z.infer<typeof ResearchResultSchema>

export const PlatformVariantSchema = z.object({
  caption: z.string().default(''),
  hashtags: z.array(z.string()).default([]),
})

/**
 * One article, one body per publishing target (PRD §10 D07, locked option (a)).
 * Long-form targets (wordpress/github) carry the SEO/GEO version; social
 * targets carry the platform-reaction version. `default` is the key used when
 * the owner picked no platform at all.
 */
export const ArticleVariantSchema = z.object({
  body: z.string().default(''),
  keywords: z.array(z.string()).default([]),
  notes: z.string().default(''),
})

export const SocialPostDraftSchema = z.object({
  outputKind: z.literal('social_post_draft'),
  caption: z.string().default(''),
  // Long-form markdown body. Defaulted, so every artifact submitted before
  // the field existed still validates (PRD-CONTENT-PIPELINE-OVERHAUL §2.2).
  article: z.string().default(''),
  // Per-platform bodies, added BESIDE `article` (never replacing it) and
  // defaulted to `{}` so every pre-D07 artifact still validates (PRD §10.1.2).
  variants: z.record(z.string(), ArticleVariantSchema).default({}),
  // Target keyword the SEO/GEO variant and the repair are grounded in.
  // Defaulted for the same reason as `article`.
  keyword: z.string().default(''),
  platformVariants: z.record(z.string(), PlatformVariantSchema).default({}),
  slideCopy: z.array(z.string()).default([]),
  cta: z.string().default(''),
  claims: z.array(z.object({
    text: z.string(),
    evidence: z.array(z.string()).default([]),
  })).default([]),
  sources: z.array(z.string()).default([]),
})

export type SocialPostDraft = z.infer<typeof SocialPostDraftSchema>

export const HumanizedPostSchema = z.object({
  outputKind: z.literal('humanized_social_post'),
  caption: z.string().default(''),
  platformVariants: z.record(z.string(), PlatformVariantSchema).default({}),
  changeSummary: z.array(z.string()).default([]),
  preservedClaims: z.array(z.string()).default([]),
  toneCheck: z.record(z.string(), z.string()).default({}),
})

export type HumanizedPost = z.infer<typeof HumanizedPostSchema>

export const FabricSceneSchema = z.object({
  outputKind: z.literal('fabric_scene'),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1350),
  slides: z.array(z.object({
    scene: z.record(z.string(), z.unknown()),
    altText: z.string().default(''),
    templateKey: z.string().default(''),
  })).default([]),
  assetRefs: z.array(z.string()).default([]),
  fontRequests: z.array(z.string()).default([]),
})

export type FabricScene = z.infer<typeof FabricSceneSchema>

export const ReelStoryboardSchema = z.object({
  outputKind: z.literal('reel_storyboard'),
  caption: z.string().default(''),
  coverText: z.string().default(''),
  coverAssetId: z.string().default(''),
  audioNotes: z.string().default(''),
  durationSeconds: z.number().default(30),
  scenes: z.array(z.object({
    index: z.number().int().default(0),
    durationSeconds: z.number().default(3),
    sceneText: z.string().default(''),
    voiceover: z.string().default(''),
    narration: z.string().default(''),
    assetRef: z.string().default(''),
    assetRefs: z.array(z.string()).default([]),
    caption: z.string().default(''),
    transition: z.string().default('cut'),
  })).default([]),
  assetRefs: z.array(z.string()).default([]),
})

export type ReelStoryboard = z.infer<typeof ReelStoryboardSchema>

export const CarouselSlideSchema = z.object({
  id: z.string().default(''),
  role: z.string().default('value'),
  headline: z.string().default(''),
  body: z.string().default(''),
  altText: z.string().default(''),
  template: z.string().default('big-statement'),
  kicker: z.string().optional().default(''),
  items: z.array(z.string()).optional().default([]),
  stat: z.string().optional().default(''),
  statLabel: z.string().optional().default(''),
  quote: z.string().optional().default(''),
  author: z.string().optional().default(''),
  cta: z.string().optional().default(''),
})

export type CarouselSlideOutput = z.infer<typeof CarouselSlideSchema>

export const CarouselArtifactSchema = z.object({
  outputKind: z.literal('carousel'),
  caption: z.string().default(''),
  slides: z.array(CarouselSlideSchema).min(2).max(10),
  sourceType: z.string().default('article'),
  sourceId: z.string().default(''),
  sourceRef: z.string().default(''),
  platformVariants: z.record(z.string(), PlatformVariantSchema).default({}),
  fullRegeneration: z.boolean().default(false),
  targetedSlideIds: z.array(z.string()).default([]),
})

export type CarouselArtifact = z.infer<typeof CarouselArtifactSchema>

export const ApprovalRequestSchema = z.object({
  outputKind: z.literal('approval_request'),
  artifactId: z.string(),
  summary: z.string().default(''),
})

export const PublishingIntentSchema = z.object({
  outputKind: z.literal('publishing_intent'),
  artifactId: z.string(),
  connectionId: z.string(),
  mode: z.string().default('draft'),
})

export const GithubArticleSchema = z.object({
  outputKind: z.literal('github_article'),
  title: z.string().min(1),
  description: z.string().default(''),
  slug: z.string().min(1),
  language: z.string().default('en'),
  targetPath: z.string().min(1),
  repository: z.string().min(1),
  branch: z.string().default('main'),
  frontmatter: z.record(z.string(), z.unknown()).default({}),
  markdown: z.string().min(1),
  rawMarkdown: z.string().default(''),
})

export type GithubArticle = z.infer<typeof GithubArticleSchema>

export const WordpressArticleSchema = z.object({
  outputKind: z.literal('wordpress_article'),
  title: z.string().min(1),
  slug: z.string().min(1),
  language: z.string().default('en'),
  content: z.string().min(1),
  excerpt: z.string().default(''),
  category: z.string().default(''),
  tags: z.array(z.string()).default([]),
  featuredImage: z.string().default(''),
  status: z.enum(['draft', 'publish']).default('draft'),
  wordpressUrl: z.string().default(''),
})

export type WordpressArticle = z.infer<typeof WordpressArticleSchema>

const ARTIFACT_CONTRACTS = {
  research_result: ResearchResultSchema,
  social_post_draft: SocialPostDraftSchema,
  humanized_social_post: HumanizedPostSchema,
  fabric_scene: FabricSceneSchema,
  reel_storyboard: ReelStoryboardSchema,
  carousel: CarouselArtifactSchema,
  approval_request: ApprovalRequestSchema,
  publishing_intent: PublishingIntentSchema,
  github_article: GithubArticleSchema,
  wordpress_article: WordpressArticleSchema,
} as const

export type ArtifactOutputKind = keyof typeof ARTIFACT_CONTRACTS

export function validateArtifactOutput(kind: string, output: unknown): { ok: boolean, error?: string } {
  const schema = (ARTIFACT_CONTRACTS as Record<string, z.ZodTypeAny>)[kind]
  if (!schema) return { ok: false, error: `Unsupported artifact kind: ${kind}` }
  const parsed = schema.safeParse(output)
  return parsed.success ? { ok: true } : { ok: false, error: 'Artifact output does not match its contract' }
}
