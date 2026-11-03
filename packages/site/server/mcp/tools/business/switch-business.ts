import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { requireMcp, requireScope } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

export default defineMcpTool({
  description: 'Switch this API key to another business the key owner owns or belongs to. The choice persists on the key, so every later tool call uses the new business — no new key and no re-authentication.',
  inputSchema: {
    businessId: z.string().min(1).describe('Target business id from list-businesses'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const previousBusinessId = mcp.businessId

    try {
      const result = await apiKeyService.switchBusiness(mcp, args.businessId)
      if (!result.success || !result.context) {
        throw new Error(result.error?.message || 'Failed to switch business')
      }
      await logMcpCall(mcp, 'switch-business', args.businessId, 'success', `from=${previousBusinessId} to=${args.businessId}`)
      return {
        previousBusinessId,
        currentBusinessId: result.context.businessId,
        note: 'Later tool calls in this session use the new business.',
      }
    }
    catch (error) {
      await logMcpCall(mcp, 'switch-business', args.businessId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
