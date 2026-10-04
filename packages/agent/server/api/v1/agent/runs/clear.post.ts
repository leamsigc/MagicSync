import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { agentRunService } from '#layers/BaseAgent/server/services/agent-run.service'

const ClearRunsSchema = z.object({
  businessId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = ClearRunsSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const result = await agentRunService.clearFinished(user.id, body.businessId)
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error })
  return result.data
})
