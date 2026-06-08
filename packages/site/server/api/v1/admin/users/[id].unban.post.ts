import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useAuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const authApi = useAuthApi(event)

  try {
    const result = await authApi.unbanUser({
      body: { userId }
    })
    return { success: true, result }
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to unban user'
    })
  }
})
