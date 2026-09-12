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

export const SocialPostDraftSchema = z.object({
  outputKind: z.literal('social_post_draft'),
  caption: z.string().default(''),
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

const ARTIFACT_CONTRACTS = {
  research_result: ResearchResultSchema,
  social_post_draft: SocialPostDraftSchema,
  humanized_social_post: HumanizedPostSchema,
  fabric_scene: FabricSceneSchema,
  reel_storyboard: ReelStoryboardSchema,
  approval_request: ApprovalRequestSchema,
  publishing_intent: PublishingIntentSchema,
} as const

export type ArtifactOutputKind = keyof typeof ARTIFACT_CONTRACTS

export function validateArtifactOutput(kind: string, output: unknown): { ok: boolean, error?: string } {
  const schema = (ARTIFACT_CONTRACTS as Record<string, z.ZodTypeAny>)[kind]
  if (!schema) return { ok: false, error: `Unsupported artifact kind: ${kind}` }
  const parsed = schema.safeParse(output)
  return parsed.success ? { ok: true } : { ok: false, error: 'Artifact output does not match its contract' }
}
