import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

const SafeModeSchema = z.object({ safeMode: z.boolean() })

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })

  const body = await readValidatedBody(event, SafeModeSchema.parse)

  const result = await businessProfileService.setSafeMode(id, body.safeMode, user.id, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : 400, statusMessage: result.error })
  }
  return { safeMode: result.data }
})
