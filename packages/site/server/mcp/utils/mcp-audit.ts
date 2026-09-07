import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'

/**
 * Audit every MCP tool call. logAuditEvent() never throws (try/catch inside),
 * so this is safe to await in tool handlers. Gives the admin audit UI full
 * MCP visibility with no extra work.
 */
export async function logMcpCall(
  mcp: ApiKeyContext,
  tool: string,
  targetId?: string,
  status: 'success' | 'failure' = 'success',
  details?: string
): Promise<void> {
  await logAuditService.logAuditEvent({
    userId: mcp.userId || undefined,
    category: 'mcp',
    action: tool,
    targetType: 'mcp-tool',
    targetId,
    status,
    details: details ?? `key=${mcp.keyId} business=${mcp.businessId}`,
  })
}
