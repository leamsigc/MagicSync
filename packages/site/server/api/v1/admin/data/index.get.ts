import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { adminDataService } from '#layers/BaseDB/server/services/admin-data.service'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const result = await adminDataService.listTables()
  if (!result.success) {
    throw createError({ statusCode: 500, message: result.error })
  }

  return { tables: result.data }
})
