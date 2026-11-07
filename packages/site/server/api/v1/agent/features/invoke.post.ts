import { z } from 'zod'
import type { H3Event } from 'h3'
import { getHeaders } from 'h3'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'
import { invokeFeature } from '../../../../mcp/utils/tool-registry'

const InvokeSchema = z.object({
  businessId: z.string().min(1),
  feature: z.string().min(1).max(120),
  arguments: z.record(z.string(), z.unknown()).optional(),
})

/**
 * A chat session is already authenticated and business-scoped, so it can act as
 * the MCP caller for one invocation. Shared business rows (posts, assets,
 * playbooks) are owned by the business owner, so `userId` is the owner id while
 * the acting member travels in metadata for audit.
 */
function sessionContext(event: H3Event, ownerUserId: string, businessId: string, actorUserId: string): ApiKeyContext {
  return {
    valid: true,
    keyId: 'chat-session',
    userId: ownerUserId,
    orgId: '',
    businessId,
    connectedPlatforms: [],
    name: 'Chat session',
    mcpScope: 'full',
    ownerUserId,
    metadata: { source: 'chat', actorUserId, requestId: event.context.requestId },
  }
}

/**
 * Run any MCP feature from chat. The handler and its audit log are the same ones
 * the `/mcp` route uses; only the caller identity differs. Validation errors are
 * returned so the agent can correct its arguments without a failed HTTP turn.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = InvokeSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success || !access.data) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const result = await invokeFeature(
    body.feature,
    body.arguments ?? {},
    sessionContext(event, access.data.ownerUserId, body.businessId, user.id),
    getHeaders(event),
  )

  return result
})
