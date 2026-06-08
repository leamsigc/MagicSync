import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useAuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'
import { z } from 'zod'

const BanSchema = z.object({
  banReason: z.string().optional().default('Violated terms of service'),
  banExpiresIn: z.number().optional()
})

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const body = await readValidatedBody(event, BanSchema.parse)
  const authApi = useAuthApi(event)

  try {
    const result = await authApi.banUser({
      body: {
        userId,
        banReason: body.banReason,
        banExpiresIn: body.banExpiresIn
      }
    })
    return { success: true, result }
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to ban user'
    })
  }
})
