import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { contentChainService, type ChainContext, type DraftOutput } from '../../services/content-chain.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

function toolError(code: string | undefined, message: string): never {
  throw new Error(`${code ?? 'CONTENT_ERROR'}: ${message}`)
}

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

export function createContentTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'write_post',
      label: 'Write a post',
      description: 'Draft a platform-aware social post from a research brief.',
      parameters: Type.Object({
        brief: Type.String({ description: 'Research brief or topic summary' }),
        platforms: Type.Optional(Type.Array(Type.String(), { description: 'Target platforms' })),
        itemId: Type.Optional(Type.String({ description: 'Content card id to log the step against' })),
      }),
      execute: async (_toolCallId, params) => {
        const result = await contentChainService.writePost(chainContext(ctx), {
          brief: params.brief,
          platforms: params.platforms ?? [],
        })
        if (!result.success) toolError(result.code, result.error)
        if (params.itemId) {
          await contentBoardService.recordRun(ctx.userId, ctx.businessId, params.itemId, { step: 'write_post', status: 'completed' }, ctx.event)
        }
        return toolResult({ draft: result.success ? result.data : null })
      },
    }),
    defineTool({
      name: 'humanize',
      label: 'Humanize a draft',
      description: 'Rewrite a draft to sound natural while preserving every claim.',
      parameters: Type.Object({
        caption: Type.String({ description: 'Draft caption' }),
        claims: Type.Optional(Type.Array(Type.String(), { description: 'Claims that must survive verbatim' })),
        cta: Type.Optional(Type.String()),
        itemId: Type.Optional(Type.String({ description: 'Content card id to log the step against' })),
      }),
      execute: async (_toolCallId, params) => {
        const result = await contentChainService.humanize(chainContext(ctx), {
          draft: draftFromParams(params),
        })
        if (!result.success) toolError(result.code, result.error)
        if (params.itemId) {
          await contentBoardService.recordRun(ctx.userId, ctx.businessId, params.itemId, { step: 'humanize', status: 'completed' }, ctx.event)
        }
        return toolResult(result.success ? result.data : null)
      },
    }),
    defineTool({
      name: 'revise_draft',
      label: 'Revise a card draft',
      description: 'Revise a content-board card\'s existing draft from feedback (user notes plus the latest failing seo/geo/link checks and the virality estimate). Edits the artifact in place and re-runs the checks. Pass platforms to restrict the rewrite to those variants.',
      parameters: Type.Object({
        itemId: Type.String({ description: 'Content card id whose draft to revise' }),
        feedback: Type.Optional(Type.String({ description: 'What to change, e.g. user feedback or check findings' })),
        platforms: Type.Optional(Type.Array(Type.String(), { description: 'Only revise these platform variants' })),
      }),
      execute: async (_toolCallId, params) => {
        const result = await contentChainService.reviseDraft(chainContext(ctx), {
          itemId: params.itemId,
          feedback: params.feedback,
          onlyPlatforms: params.platforms,
        })
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success
          ? { artifactId: result.data.artifactId, caption: result.data.caption, checks: result.data.checks }
          : null)
      },
    }),
    defineTool({
      name: 'check_seo',
      label: 'Run SEO checks',
      description: 'Score a draft for SEO and record the findings on the card.',
      parameters: checkParams(),
      execute: async (_toolCallId, params) => {
        const result = await contentChainService.checkSeo(chainContext(ctx), {
          itemId: params.itemId,
          draft: draftFromParams(params),
        })
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ check: result.success ? result.data : null })
      },
    }),
    defineTool({
      name: 'check_geo',
      label: 'Run GEO checks',
      description: 'Score a draft for generative-engine readiness and record the findings.',
      parameters: checkParams(),
      execute: async (_toolCallId, params) => {
        const result = await contentChainService.checkGeo(chainContext(ctx), {
          itemId: params.itemId,
          draft: draftFromParams(params),
        })
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ check: result.success ? result.data : null })
      },
    }),
    defineTool({
      name: 'check_links',
      label: 'Check links',
      description: 'Validate links in a draft and record the findings.',
      parameters: checkParams(),
      execute: async (_toolCallId, params) => {
        const result = await contentChainService.checkLinks(chainContext(ctx), {
          itemId: params.itemId,
          draft: draftFromParams(params),
        })
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ check: result.success ? result.data : null })
      },
    }),
  ]
}

function checkParams() {
  return Type.Object({
    itemId: Type.String({ description: 'Content card id the check belongs to' }),
    caption: Type.String({ description: 'Draft caption to check' }),
    cta: Type.Optional(Type.String()),
    claims: Type.Optional(Type.Array(Type.String())),
  })
}
