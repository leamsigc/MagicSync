import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { ContentItemFormatSchema } from '#layers/BaseDB/db/schema'

export const CreateContentItemSchema = z.object({
  businessId: z.string().min(1),
  title: z.string().min(1).max(200),
  brief: z.string().max(5000).optional(),
  format: ContentItemFormatSchema.optional(),
  platforms: z.array(z.string().min(1).max(40)).max(12).optional(),
  sourceType: z.enum(['trend', 'manual', 'template', 'repurpose']).optional(),
  priority: z.number().int().min(0).max(10).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = CreateContentItemSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const result = await contentBoardService.create(user.id, body.businessId, {
    title: body.title,
    brief: body.brief,
    format: body.format,
    platforms: body.platforms,
    sourceType: body.sourceType,
    priority: body.priority,
    createdBy: 'user',
    createdByUserId: user.id,
  }, event)
  if (!result.success) throw createError({ statusCode: 400, statusMessage: result.error })
  return { item: result.data }
})
