import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import { buildCapabilityRunContext } from '#layers/BaseAgent/server/capabilities/run-context'
import { runCapability } from '#layers/BaseAgent/server/capabilities'
import '#layers/BaseAgent/server/capabilities/social'

export function generationErrorStatus(code?: string): number {
  if (code === 'MODEL_NOT_CONFIGURED' || code === 'MODEL_NOT_AVAILABLE') return 503
  if (code === 'NOT_FOUND') return 404
  if (code === 'FORBIDDEN') return 403
  if (code?.startsWith('CONTEXT_') || code === 'BRAND_CONTEXT_REQUIRED' || code === 'VALIDATION_ERROR') return 400
  return 502
}

/**
 * Branded generation through a declared social capability. Routes pass
 * structured input only — no prompt strings live in route handlers. Errors
 * keep their coded status (503/404/403/400, 502 fallback).
 */
export async function runSocialCapability<T>(
  userId: string,
  capabilityId: string,
  input: Record<string, unknown>,
  context: {
    businessId?: string | null
    useBusinessContext?: boolean
    event?: H3Event
    log?: RequestLogger
  } = {},
): Promise<T> {
  let ctx
  try {
    ctx = await buildCapabilityRunContext(userId, context.businessId ?? null, {
      useBusinessContext: context.useBusinessContext,
      event: context.event,
      log: context.log,
      capability: capabilityId,
    })
  } catch (error) {
    throw capabilityError(error, 'Generation failed')
  }
  const outcome = await runCapability(capabilityId, input, ctx)
  if (!outcome.ok) {
    throw createError({ statusCode: generationErrorStatus(outcome.code), statusMessage: outcome.error, data: { code: outcome.code } })
  }
  return outcome.output as T
}

function capabilityError(error: unknown, fallback: string) {
  const code = typeof (error as { code?: unknown } | null)?.code === 'string'
    ? (error as { code: string }).code
    : 'CAPABILITY_FAILED'
  return createError({
    statusCode: generationErrorStatus(code),
    statusMessage: error instanceof Error ? error.message : fallback,
    data: { code },
  })
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(item => typeof item === 'string') as string[]
}

export function toHashtags(text: string): string[] {
  return text.match(/#[\p{L}\p{N}_]+/gu) ?? []
}

export interface SocialPostPayload {
  text: string
  hashtags: string[]
  platform: string
  character_count: number
}

export function toSocialPost(value: unknown, platform: string): SocialPostPayload {
  const json = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const text = String(json.text ?? '')
  return {
    text,
    hashtags: asStringArray(json.hashtags ?? toHashtags(text)),
    platform,
    character_count: text.length,
  }
}

export function contextFlags(body: Record<string, unknown>) {
  return {
    businessId: (body.businessId ?? body.business_id ?? null) as string | null,
    useBusinessContext: body.useBusinessContext === true || body.use_business_context === true,
  }
}

/** Post IDs for an engagement check: explicit body list first, then the artifact's own published post. */
export function resolveCheckPostIds(body: { postIds?: unknown }, artifactPostId: string | null): string[] {
  if (Array.isArray(body.postIds) && body.postIds.every(id => typeof id === 'string')) return body.postIds
  if (artifactPostId) return [artifactPostId]
  return []
}
