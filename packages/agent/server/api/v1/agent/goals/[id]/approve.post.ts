import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { decideCapabilityApproval } from '#layers/BaseAgent/server/flue/approvals'

const ApprovalSchema = z.object({ approved: z.boolean() })
const APPROVAL_ERROR_STATUS: Record<string, number> = { NOT_FOUND: 404, INVALID_STATE: 409 }

/** Approve or cancel a consequential capability run through the shared gate. */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'id') ?? ''
  const body = ApprovalSchema.parse(await readBody(event))
  const decision = await decideCapabilityApproval(user.id, runId, body.approved)
  if (!decision.supported) {
    throw createError({ statusCode: 404, statusMessage: 'Approval run not found' })
  }
  if (decision.status === 'failed') {
    throw createError({
      statusCode: APPROVAL_ERROR_STATUS[decision.code ?? ''] ?? 500,
      statusMessage: decision.error,
    })
  }
  return { status: decision.status ?? 'completed' }
})
