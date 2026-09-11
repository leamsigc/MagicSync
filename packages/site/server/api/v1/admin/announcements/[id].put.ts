import { z } from 'zod'
import { announcementService } from '#layers/BaseDB/server/services/announcement.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

const AnnouncementSchema = z.object({
  title: z.string().min(1).max(120),
  html: z.string().min(1).max(20000),
  publishAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
})

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Announcement ID is required' })
  }

  const body = await readValidatedBody(event, AnnouncementSchema.parse)

  const result = await announcementService.upsert(currentUser.id, id, body)
  if (result.error) {
    throw createError({ statusCode: 500, message: result.error })
  }

  return result.data
})
