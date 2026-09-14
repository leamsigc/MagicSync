import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'
import { businessContextResolver } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export interface McpAiContext {
  ownerId: string
  businessContext: string | undefined
  editionId: string | null
}

/**
 * Authenticate an MCP AI tool call (T20). The API key's bound business is the
 * authority — client input never selects the business. Branded grounding uses
 * the business owner's current playbook; calls proceed ungrounded only when
 * no playbook is published yet. All other context failures are loud.
 */
export async function resolveMcpAiContext(mcp: ApiKeyContext): Promise<McpAiContext> {
  const business = await businessProfileService.findByIdOnly(mcp.businessId)
  if (!business.success || !business.data) {
    throw new Error('Business not found for this API key')
  }
  const ownerId = business.data.userId
  const brand = await businessContextResolver.resolve(ownerId, {
    businessId: mcp.businessId,
    useBusinessContext: true,
  })
  let prompt: string | undefined
  let editionId: string | null = null
  if (!brand.success || !brand.data) {
    if (!brand.success && brand.code !== 'BRAND_CONTEXT_REQUIRED') {
      throw new Error(brand.error ?? 'Failed to resolve brand context')
    }
  }
  else if (brand.data.enabled) {
    prompt = brand.data.prompt
    editionId = brand.data.editionId
  }
  return { ownerId, businessContext: prompt, editionId }
}
