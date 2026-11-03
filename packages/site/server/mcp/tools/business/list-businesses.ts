import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'

function businessShape(business: { id: string, name: string, category?: string | null, website?: string | null }, currentBusinessId: string) {
  return {
    id: business.id,
    name: business.name,
    category: business.category ?? null,
    website: business.website ?? null,
    current: business.id === currentBusinessId,
  }
}

export default defineMcpTool({
  description: 'List the businesses this API key can operate and mark the current one. Use switch-business to change it; no new key or re-authentication needed.',
  inputSchema: {},
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  async handler() {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)

    if (!mcp.ownerUserId) {
      const result = await businessProfileService.findById(mcp.businessId, userId)
      if (!result.success || !result.data) {
        throw new Error('Business profile not found for this API key.')
      }
      return {
        currentBusinessId: mcp.businessId,
        switching: false,
        businesses: [businessShape(result.data, mcp.businessId)],
      }
    }

    const result = await businessProfileService.findByUserIdWithMembership(mcp.ownerUserId, {
      pagination: { page: 1, limit: 100 },
    })
    if (!result.success) throw new Error('Failed to list businesses for this key owner.')
    return {
      currentBusinessId: mcp.businessId,
      switching: true,
      businesses: (result.data ?? []).map(business => businessShape(business, mcp.businessId)),
    }
  },
})
