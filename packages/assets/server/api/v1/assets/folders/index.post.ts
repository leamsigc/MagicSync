import { z } from 'zod'
import { assetService } from '#layers/BaseShared/server/services/asset.service'

const bodySchema = z.object({
  businessId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    log.error('Invalid folder payload', { issues: parsed.error.issues })
    throw createError({ statusCode: 400, statusMessage: 'businessId and name are required' })
  }

  const result = await assetService.createFolder(
    parsed.data.businessId,
    user.id,
    parsed.data.name,
    event,
  )
  if (!result.success) {
    log.error('Failed to create asset folder', { code: result.code, error: result.error })
    throw createError({
      statusCode: result.code === 'CONFLICT' ? 409 : result.code === 'VALIDATION' ? 400 : 404,
      statusMessage: result.error,
    })
  }

  // Return the summary shape, not the bare row: the client types this as an
  // AssetFolderSummary and renders `name (count)`, so a row without assetCount
  // would render an empty pair of parentheses.
  return { success: true, data: { ...result.data, assetCount: 0 } }
})