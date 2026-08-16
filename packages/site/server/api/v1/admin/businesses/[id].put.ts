import { z } from 'zod'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

const AdminUpdateBusinessSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const body = await readValidatedBody(event, AdminUpdateBusinessSchema.parse)

  const result = await businessProfileService.updateRaw(id, body)
  if (!result.success) {
    throw createError({
      statusCode: result.code === '404' ? 404 : 500,
      message: result.error || 'Failed to update business'
    })
  }

  return result.data
})
