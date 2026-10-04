import { z } from 'zod'
import { assetService } from '#layers/BaseShared/server/services/asset.service'

const querySchema = z.object({
  businessId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    log.error('Invalid folder list query', { issues: parsed.error.issues })
    throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  }

  const result = await assetService.listFolders(parsed.data.businessId, user.id, event)
  if (!result.success) {
    log.error('Failed to list asset folders', { code: result.code, error: result.error })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 500,
      statusMessage: result.error,
    })
  }

  return { success: true, data: result.data }
})