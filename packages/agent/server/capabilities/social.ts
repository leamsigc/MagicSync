import { z } from 'zod'
import { capabilityRegistry, type Capability, type CapabilityRunContext } from './registry'
import { extractJsonObject } from '../utils/run-config'

/**
 * T20 social generation capabilities — one declared capability per former
 * raw-completion call site (PRD §3.7). Prompt semantics moved verbatim from
 * the MCP AI tools into the registry; routes are thin adapters
 * (auth → resolve → `runCapability` → shape). No route writes its own prompt.
 */

const CaptionInputSchema = z.object({
  topic: z.string().min(1),
  platform: z.string().min(1),
  tone: z.string().min(1).default('professional'),
  includeHashtags: z.boolean().default(true),
  includeCta: z.boolean().default(false),
  additionalContext: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const CaptionOutputSchema = z.object({
  text: z.string(),
  hashtags: z.array(z.string()),
})

function buildCaptionPrompt(input: z.infer<typeof CaptionInputSchema>): string {
  return [
    `Write one ${input.platform} post about: ${input.topic}.`,
    `Tone: ${input.tone}.`,
    input.includeHashtags ? 'Include 3-5 relevant hashtags.' : 'Do not include hashtags.',
    input.includeCta ? 'End with a clear call to action.' : '',
    input.additionalContext ? `Extra context: ${input.additionalContext}` : '',
    input.maxLength ? `Keep the caption under ${input.maxLength} characters.` : '',
    'Return strict JSON: {"text": string, "hashtags": string[]}.',
  ].filter(Boolean).join('\n')
}

async function runCaption(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = CaptionInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid caption input', code: 'VALIDATION_ERROR' }
  }
  const text = await ctx.complete({
    system: parsed.data.system,
    prompt: buildCaptionPrompt(parsed.data),
    maxTokens: parsed.data.maxTokens ?? 1200,
  })
  const json = extractJsonObject(text) ?? {}
  return {
    success: true as const,
    data: {
      text: String(json.text ?? text),
      hashtags: Array.isArray(json.hashtags) ? json.hashtags.filter(item => typeof item === 'string') : [],
    },
  }
}

const socialCaptionCapability: Capability = {
  id: 'social.caption',
  title: 'Write a post',
  description: 'Write one platform post with hashtags in the business voice.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runCaption(input, ctx),
  inputSchema: CaptionInputSchema,
  outputSchema: CaptionOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'draft',
}

const HooksInputSchema = z.object({
  topic: z.string().min(1),
  platform: z.string().min(1),
  count: z.number().int().min(1).max(15).default(5),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const HookSchema = z.object({ hook: z.string(), hook_type: z.string() })

const HooksOutputSchema = z.object({ hooks: z.array(HookSchema) })

function buildHooksPrompt(input: z.infer<typeof HooksInputSchema>): string {
  return [
    `Write ${input.count} scroll-stopping hooks for a ${input.platform} post about: ${input.topic}.`,
    'Return strict JSON: {"hooks": [{"hook": string, "hook_type": string}]}.',
  ].join('\n')
}

async function runHooks(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = HooksInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid hooks input', code: 'VALIDATION_ERROR' }
  }
  const text = await ctx.complete({
    system: parsed.data.system,
    prompt: buildHooksPrompt(parsed.data),
    maxTokens: parsed.data.maxTokens ?? 1200,
  })
  const json = extractJsonObject(text) ?? {}
  const rawHooks = Array.isArray(json.hooks) ? json.hooks : []
  const hooks = rawHooks
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map(entry => ({ hook: String(entry.hook ?? ''), hook_type: String(entry.hook_type ?? 'general') }))
    .filter(entry => entry.hook.length > 0)
  if (hooks.length === 0) {
    return { success: false as const, error: 'Hook generation failed', code: 'AI_PARSE_FAILED' }
  }
  return { success: true as const, data: { hooks } }
}

const socialHooksCapability: Capability = {
  id: 'social.hooks',
  title: 'Find post ideas',
  description: 'Write scroll-stopping hooks for a topic and platform.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runHooks(input, ctx),
  inputSchema: HooksInputSchema,
  outputSchema: HooksOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'ideas',
}

const HashtagsInputSchema = z.object({
  topic: z.string().min(1),
  platform: z.string().min(1),
  count: z.number().int().min(1).max(30).default(5),
  style: z.string().min(1).default('mixed'),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const HashtagsOutputSchema = z.object({ hashtags: z.array(z.string()) })

function buildHashtagsPrompt(input: z.infer<typeof HashtagsInputSchema>): string {
  return [
    `Suggest ${input.count} ${input.style} hashtags for a ${input.platform} post about: ${input.topic}.`,
    'Return strict JSON: {"hashtags": string[]}.',
  ].join('\n')
}

async function runHashtags(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = HashtagsInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid hashtags input', code: 'VALIDATION_ERROR' }
  }
  const text = await ctx.complete({
    system: parsed.data.system,
    prompt: buildHashtagsPrompt(parsed.data),
    maxTokens: parsed.data.maxTokens ?? 800,
  })
  const json = extractJsonObject(text) ?? {}
  const hashtags = Array.isArray(json.hashtags) ? json.hashtags.filter(item => typeof item === 'string') : []
  if (hashtags.length === 0) {
    return { success: false as const, error: 'Hashtag generation failed', code: 'AI_PARSE_FAILED' }
  }
  return { success: true as const, data: { hashtags } }
}

const socialHashtagsCapability: Capability = {
  id: 'social.hashtags',
  title: 'Suggest hashtags',
  description: 'Suggest hashtags for a topic and platform.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runHashtags(input, ctx),
  inputSchema: HashtagsInputSchema,
  outputSchema: HashtagsOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'ideas',
}

const SocialPostEntrySchema = z.object({
  text: z.string(),
  hashtags: z.array(z.string()).default([]),
})

type SocialPostEntry = z.infer<typeof SocialPostEntrySchema>

/** Map a model JSON entry list into validated posts (drops empty text). */
function parsePostEntries(value: unknown): SocialPostEntry[] {
  const entries = Array.isArray(value) ? value : []
  return entries
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map(entry => ({
      text: String(entry.text ?? ''),
      hashtags: Array.isArray(entry.hashtags) ? entry.hashtags.filter(item => typeof item === 'string') : [],
    }))
    .filter(entry => entry.text.length > 0)
}

const BatchInputSchema = z.object({
  topic: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
  countPerPlatform: z.number().int().min(1).max(5).default(1),
  tone: z.string().min(1).default('professional'),
  includeHashtags: z.boolean().default(true),
  includeCta: z.boolean().default(false),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const BatchOutputSchema = z.object({ posts: z.record(z.string(), z.array(SocialPostEntrySchema)) })

function buildBatchPrompt(input: z.infer<typeof BatchInputSchema>): string {
  return [
    `Write ${input.countPerPlatform} post(s) per platform for: ${input.topic}.`,
    `Platforms: ${input.platforms.join(', ')}. Tone: ${input.tone}.`,
    input.includeHashtags ? 'Include 3-5 relevant hashtags per post.' : 'Do not include hashtags.',
    input.includeCta ? 'End each post with a clear call to action.' : '',
    'Return strict JSON: {"posts": {"<platform>": [{"text": string, "hashtags": string[]}]}}.',
  ].filter(Boolean).join('\n')
}

async function runBatch(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = BatchInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid batch input', code: 'VALIDATION_ERROR' }
  }
  const text = await ctx.complete({
    system: parsed.data.system,
    prompt: buildBatchPrompt(parsed.data),
    maxTokens: parsed.data.maxTokens ?? 2400,
  })
  const json = extractJsonObject(text) ?? {}
  const raw = (typeof json.posts === 'object' && json.posts !== null ? json.posts : {}) as Record<string, unknown>
  const posts: Record<string, SocialPostEntry[]> = {}
  for (const platform of parsed.data.platforms) posts[platform] = parsePostEntries(raw[platform])
  return { success: true as const, data: { posts } }
}

const socialBatchCapability: Capability = {
  id: 'social.batch',
  title: 'Write posts for every platform',
  description: 'Write one or more posts per platform for a topic.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runBatch(input, ctx),
  inputSchema: BatchInputSchema,
  outputSchema: BatchOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'draft',
}

const ThreadInputSchema = z.object({
  topic: z.string().min(1),
  platform: z.string().min(1).default('twitter'),
  count: z.number().int().min(2).max(15).default(5),
  hookFirst: z.boolean().default(true),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const ThreadOutputSchema = z.object({ posts: z.array(SocialPostEntrySchema) })

function buildThreadPrompt(input: z.infer<typeof ThreadInputSchema>): string {
  return [
    `Write a ${input.count}-post ${input.platform} thread about: ${input.topic}.`,
    input.hookFirst ? 'Start with a strong hook.' : 'Do not start with a hook.',
    'Return strict JSON: {"tweets": [{"text": string, "hashtags": string[]}]}.',
  ].join('\n')
}

async function runThread(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = ThreadInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid thread input', code: 'VALIDATION_ERROR' }
  }
  const text = await ctx.complete({
    system: parsed.data.system,
    prompt: buildThreadPrompt(parsed.data),
    maxTokens: parsed.data.maxTokens ?? 1600,
  })
  const json = extractJsonObject(text) ?? {}
  return { success: true as const, data: { posts: parsePostEntries(json.tweets) } }
}

const socialThreadCapability: Capability = {
  id: 'social.thread',
  title: 'Write a thread',
  description: 'Write a numbered multi-post thread for one platform.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runThread(input, ctx),
  inputSchema: ThreadInputSchema,
  outputSchema: ThreadOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'draft',
}

const VariationsInputSchema = z.object({
  baseContent: z.string().min(1),
  platform: z.string().min(1).default('twitter'),
  count: z.number().int().min(1).max(10).default(3),
  variationType: z.string().min(1).default('rephrase'),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const VariationsOutputSchema = z.object({ posts: z.array(SocialPostEntrySchema) })

function buildVariationsPrompt(input: z.infer<typeof VariationsInputSchema>): string {
  return [
    `Create ${input.count} ${input.variationType} variations of this ${input.platform} post:`,
    input.baseContent,
    'Return strict JSON: {"variations": [{"text": string, "hashtags": string[]}]}.',
  ].join('\n')
}

async function runVariations(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = VariationsInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid variations input', code: 'VALIDATION_ERROR' }
  }
  const text = await ctx.complete({
    system: parsed.data.system,
    prompt: buildVariationsPrompt(parsed.data),
    maxTokens: parsed.data.maxTokens ?? 1600,
  })
  const json = extractJsonObject(text) ?? {}
  return { success: true as const, data: { posts: parsePostEntries(json.variations) } }
}

const socialVariationsCapability: Capability = {
  id: 'social.variations',
  title: 'Rewrite in variations',
  description: 'Rewrite one post into several variations.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runVariations(input, ctx),
  inputSchema: VariationsInputSchema,
  outputSchema: VariationsOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'draft',
}

export function registerSocialCapabilities(): void {
  const capabilities = [
    socialCaptionCapability,
    socialHooksCapability,
    socialHashtagsCapability,
    socialBatchCapability,
    socialThreadCapability,
    socialVariationsCapability,
  ]
  for (const capability of capabilities) {
    if (!capabilityRegistry.has(capability.id)) capabilityRegistry.register(capability)
  }
}

registerSocialCapabilities()

export {
  socialCaptionCapability,
  socialHooksCapability,
  socialHashtagsCapability,
  socialBatchCapability,
  socialThreadCapability,
  socialVariationsCapability,
}
