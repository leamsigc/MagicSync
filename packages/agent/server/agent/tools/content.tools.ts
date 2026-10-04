import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { contentChainService, type ChainContext, type DraftOutput } from '../../services/content-chain.service'
import { carouselGenerationService } from '../../services/carousel-generation.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'CONTENT_ERROR')

function requireComplete(ctx: AgentToolContext): NonNullable<AgentToolContext['complete']> {
  if (!ctx.complete) toolError('MODEL_UNAVAILABLE', 'No provider model is configured for this run')
  return ctx.complete
}

function chainContext(ctx: AgentToolContext): ChainContext {
  return {
    userId: ctx.userId,
    businessId: ctx.businessId,
    complete: requireComplete(ctx),
    event: ctx.event,
  }
}
function draftFromParams(params: {
  caption: string
  cta?: string
  claims?: string[]
  platformVariants?: Record<string, string>
}): DraftOutput {
  return {
    caption: params.caption,
    cta: params.cta ?? '',
    claims: params.claims ?? [],
    platformVariants: params.platformVariants ?? {},
    slideCopy: [],
    sources: [],
  }
}

/** Best-effort run-log write; the step already succeeded, never fail the tool. */
async function recordStep(ctx: AgentToolContext, itemId: string | undefined, step: string): Promise<void> {
  if (!itemId) return
  await contentBoardService.recordRun(ctx.userId, ctx.businessId, itemId, { step, status: 'completed' }, ctx.event)
}

/** Research-then-generate path (harness request or a model-supplied request). */
async function runCarouselWorkflow(ctx: AgentToolContext, data: { request?: string, instructions?: string, slideCount?: number, platform?: string }) {
  const request = ctx.carouselRequest?.trim() || data.request?.trim() || ''
  if (request === '') return null
  const { carouselWorkflowService } = await import('../../services/carousel-workflow.service')
  const result = await carouselWorkflowService.run(chainContext(ctx), {
    request: ctx.carouselRequest?.trim() || data.request || '',
    instructions: data.instructions ?? '',
    slideCount: data.slideCount ?? 10,
    platform: data.platform ?? 'instagram',
  })
  if (!result.success) toolError(result.code, result.error)
  return toolResult(result.success ? result.data : null)
}

/** Reuse an approved card's artifact instead of researching (legacy path). */
async function generateFromSource(ctx: AgentToolContext, sourceId: string, instructions: string, slideCount: number | undefined) {
  if (!sourceId) toolError('VALIDATION_ERROR', 'Pass a request to research and generate, or a sourceId to reuse a card')
  const result = await carouselGenerationService.generate(chainContext(ctx), {
    sourceId,
    instructions: instructions ?? '',
    slideCount: slideCount ?? 6,
  })
  if (!result.success) toolError(result.code, result.error)
  const legacy = result.success ? result.data : null
  return toolResult(legacy ? { workflow: 'carousel', state: 'review', ...legacy, research: null, platform: 'instagram', slideCount: legacy.slides.length } : null)
}

/**
 * The eight content tools for one run. Every prompt lives in
 * `contentChainService` / `carouselGenerationService` — the tool modules only
 * validate the model's arguments and shape the answer.
 */
export function createContentTools(ctx: AgentToolContext): ToolDefinition[] {
  const checkInput = v.object({
    itemId: v.pipe(v.string(), v.description('Content card id the check belongs to')),
    caption: v.pipe(v.string(), v.description('Draft caption to check')),
    cta: v.optional(v.string()),
    claims: v.optional(v.array(v.string())),
  })

  return [
    defineTool({
      name: 'write_post',
      description: 'Draft a platform-aware social post from a research brief.',
      input: v.object({
        brief: v.pipe(v.string(), v.description('Research brief or topic summary')),
        platforms: v.optional(v.array(v.string())),
        itemId: v.optional(v.pipe(v.string(), v.description('Content card id to log the step against'))),
      }),
      run: async (toolCtx) => {
        const { brief, platforms, itemId } = toolCtx.data
        const result = await contentChainService.writePost(chainContext(ctx), { brief, platforms: platforms ?? [] })
        if (!result.success) toolError(result.code, result.error)
        await recordStep(ctx, itemId, 'write_post')
        return toolResult({ draft: result.success ? result.data : null })
      },
    }),
    defineTool({
      name: 'humanize',
      description: 'Rewrite a draft to sound natural while preserving every claim.',
      input: v.object({
        caption: v.pipe(v.string(), v.description('Draft caption')),
        claims: v.optional(v.array(v.pipe(v.string(), v.description('Claims that must survive verbatim')))),
        cta: v.optional(v.string()),
        itemId: v.optional(v.pipe(v.string(), v.description('Content card id to log the step against'))),
      }),
      run: async (toolCtx) => {
        const data = toolCtx.data
        const result = await contentChainService.humanize(chainContext(ctx), { draft: draftFromParams(data) })
        if (!result.success) toolError(result.code, result.error)
        await recordStep(ctx, data.itemId, 'humanize')
        return toolResult(result.success ? result.data : null)
      },
    }),
    defineTool({
      name: 'revise_draft',
      description: 'Revise a content-board card\'s existing draft from feedback (user notes plus the latest failing seo/geo/link checks and the virality estimate). Edits the artifact in place and re-runs the checks. Pass platforms to restrict the rewrite to those variants.',
      input: v.object({
        itemId: v.pipe(v.string(), v.description('Content card id whose draft to revise')),
        feedback: v.optional(v.pipe(v.string(), v.description('What to change, e.g. user feedback or check findings'))),
        platforms: v.optional(v.array(v.pipe(v.string(), v.description('Only revise these platform variants')))),
      }),
      run: async (toolCtx) => {
        const { itemId, feedback, platforms } = toolCtx.data
        const result = await contentChainService.reviseDraft(chainContext(ctx), {
          itemId,
          feedback,
          onlyPlatforms: platforms,
        })
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success
          ? { artifactId: result.data.artifactId, caption: result.data.caption, checks: result.data.checks }
          : null)
      },
    }),
    defineTool({
      name: 'check_seo',
      description: 'Score a draft for SEO and record the findings on the card.',
      input: checkInput,
      run: async (toolCtx) => {
        const data = toolCtx.data
        const result = await contentChainService.checkSeo(chainContext(ctx), { itemId: data.itemId, draft: draftFromParams(data) })
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ check: result.success ? result.data : null })
      },
    }),
    defineTool({
      name: 'check_geo',
      description: 'Score a draft for generative-engine readiness and record the findings.',
      input: checkInput,
      run: async (toolCtx) => {
        const data = toolCtx.data
        const result = await contentChainService.checkGeo(chainContext(ctx), { itemId: data.itemId, draft: draftFromParams(data) })
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ check: result.success ? result.data : null })
      },
    }),
    defineTool({
      name: 'check_links',
      description: 'Validate links in a draft and record the findings.',
      input: checkInput,
      run: async (toolCtx) => {
        const data = toolCtx.data
        const result = await contentChainService.checkLinks(chainContext(ctx), { itemId: data.itemId, draft: draftFromParams(data) })
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ check: result.success ? result.data : null })
      },
    }),
    defineTool({
      name: 'generate_carousel',
      description: 'Research a topic, then generate a visual carousel with a full preview for human review. Pass a request (topic/brief); no content card is needed. Runs the carousel workflow: research → generate → review.',
      input: v.object({
        request: v.optional(v.pipe(v.string(), v.description('What the carousel should be about (topic or brief). Preferred over sourceId.'))),
        sourceId: v.optional(v.pipe(v.string(), v.description('Optional approved content card id to source the carousel from instead of research'))),
        instructions: v.optional(v.pipe(v.string(), v.description('What the carousel should cover'))),
        slideCount: v.optional(v.pipe(v.number(), v.description('Target slide count 2-10 (default 10)'))),
        platform: v.optional(v.pipe(v.string(), v.description('Target platform (default instagram)'))),
      }),
      run: async (toolCtx) => {
        const workflow = await runCarouselWorkflow(ctx, toolCtx.data)
        if (workflow) return workflow
        return generateFromSource(ctx, toolCtx.data.sourceId ?? '', toolCtx.data.instructions ?? '', toolCtx.data.slideCount)
      },
    }),
    defineTool({
      name: 'revise_carousel',
      description: 'Revise an existing carousel preview from feedback into a new version and show the updated preview. When the request names a specific slide (e.g. "slide 2", "the second page"), pass that slide\'s id in slideIds so only it changes; leaving slideIds empty revises EVERY slide, which discards the rest of the deck\'s wording.',
      input: v.object({
        artifactId: v.pipe(v.string(), v.description('Carousel artifact id to revise')),
        instructions: v.pipe(v.string(), v.description('What to change')),
        slideIds: v.optional(v.array(v.pipe(v.string(), v.description('Only these slide ids are regenerated')))),
      }),
      run: async (toolCtx) => {
        const { artifactId, instructions, slideIds } = toolCtx.data
        const result = await carouselGenerationService.revise(chainContext(ctx), {
          artifactId,
          instructions,
          slideIds: slideIds ?? [],
        })
        if (!result.success) toolError(result.code, result.error)
        const revised = result.success ? result.data : null
        return toolResult(revised ? { workflow: 'carousel', state: 'revision', ...revised, research: null, platform: 'instagram', slideCount: revised.slides.length } : null)
      },
    }),
  ]
}
