import type { H3Event } from 'h3'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { businessContextResolver } from '#layers/BaseDB/server/services/business-context-resolver.service'

export interface GoalContext {
  /** Business-grounded context (Brand Playbook); empty when ungrounded. */
  systemContext: string
  brandAvailable: boolean
}

const UNGROUNDED: GoalContext = { systemContext: '', brandAvailable: false }

/**
 * Assemble only the context a goal needs. Today that is the current Brand
 * Playbook edition (redacted + budgeted upstream); a missing playbook degrades
 * to ungrounded, but a wrong/forbidden business fails loudly.
 */
export async function assembleGoalContext(
  userId: string,
  businessId: string,
  event?: H3Event,
): Promise<ServiceResponse<GoalContext>> {
  const resolved = await businessContextResolver.resolve(userId, {
    businessId,
    useBusinessContext: true,
  }, event)
  if (resolved.success) {
    return { success: true, data: { systemContext: resolved.data.prompt, brandAvailable: resolved.data.enabled } }
  }
  const softFailure = resolved.code === 'BRAND_CONTEXT_REQUIRED' || resolved.code === 'CONTEXT_FAILED'
  if (!softFailure) return { success: false, error: resolved.error, code: resolved.code }
  return { success: true, data: UNGROUNDED }
}
