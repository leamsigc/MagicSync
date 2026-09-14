import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { agentWorkflowService } from '#layers/BaseAgent/server/services/agent-workflow.service'

const IdeaScanSchema = z.object({
  businessId: z.string().min(1),
  count: z.number().int().min(10).max(20).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = IdeaScanSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const result = await agentWorkflowService.runIdeaScan({
    userId: user.id,
    businessId: body.businessId,
    count: body.count,
    event,
  })
  if (!result.success) throw createError({ statusCode: 400, statusMessage: result.error, data: { code: result.code } })
  return { items: result.data, created: result.data.length }
})
