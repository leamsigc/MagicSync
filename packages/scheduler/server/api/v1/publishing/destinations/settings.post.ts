import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'

const Schema = z.object({
  businessId: z.string().min(1),
  connectionId: z.string().min(1),
  inspection: z.record(z.string(), z.unknown()),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = await readValidatedBody(event, Schema.parse)
  log.set({ businessId: body.businessId, connectionId: body.connectionId })
  const inspectionUnknown: unknown = body.inspection
  const inspection = inspectionUnknown as import('#layers/BaseDB/server/services/github-inspect.service').RepoInspection
  const result = await destinationService.saveRepositorySettings(user.id, {
    businessId: body.businessId,
    connectionId: body.connectionId,
    inspection,
  }, event)
  if (!result.success) throw createError({ statusCode: 400, statusMessage: result.error })
  log.info({ message: 'Repository settings saved' })
  return result
})
