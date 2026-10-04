import { z } from 'zod'
import { assetService } from '#layers/BaseShared/server/services/asset.service'

const bodySchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1).max(500),
  businessId: z.string().min(1),
  // `null` is a first-class move back to the unfiled bucket, not a delete.
  folderId: z.string().min(1).nullable(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    log.error('Invalid move payload', { issues: parsed.error.issues })
    throw createError({ statusCode: 400, statusMessage: 'assetIds, businessId and folderId are required' })
  }

  const result = await assetService.moveToFolder(parsed.data, user.id, event)
  if (!result.success) {
    log.error('Failed to move assets', { code: result.code, error: result.error })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 500,
      statusMessage: result.error,
    })
  }

  log.info('Assets moved', { moved: result.data.moved, rejected: result.data.rejected.length })
  return { success: true, data: result.data }
})