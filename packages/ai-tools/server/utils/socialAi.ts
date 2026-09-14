import { completeForUser, type UserCompletionInput } from '#layers/BaseAgent/server/utils/run-config'

export function generationErrorStatus(code?: string): number {
  if (code === 'MODEL_NOT_CONFIGURED' || code === 'MODEL_NOT_AVAILABLE') return 503
  if (code === 'NOT_FOUND') return 404
  if (code === 'FORBIDDEN') return 403
  if (code?.startsWith('CONTEXT_') || code === 'BRAND_CONTEXT_REQUIRED' || code === 'VALIDATION_ERROR') return 400
  return 502
}

export async function socialComplete(userId: string, input: UserCompletionInput) {
  const result = await completeForUser(userId, input)
  if (!result.success) {
    throw createError({ statusCode: generationErrorStatus(result.code), statusMessage: result.error, data: { code: result.code } })
  }
  return result.data
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

