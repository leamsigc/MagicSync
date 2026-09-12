import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { publishingService } from "#layers/BaseDB/server/services/publishing.service"

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)
  const result = await publishingService.createJob(user.id, body, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})
