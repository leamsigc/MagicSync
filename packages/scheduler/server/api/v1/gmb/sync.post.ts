import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const body = await readBody(event)
  const businessId = body.businessId
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId is required' })

  const business = await businessProfileService.findById(businessId, user.id)
  if (business.error) throw createError({ statusCode: 404, message: business.error })

  const gmbAccounts = await socialMediaAccountService.getAccounts({ businessId, platform: 'googlemybusiness' })
  if (!gmbAccounts.length) throw createError({ statusCode: 404, message: 'No GMB account connected' })

  const tokens = await socialMediaAccountService.getDecryptedTokens(gmbAccounts[0])
  if (!tokens.accessToken) throw createError({ statusCode: 401, message: 'GMB access token unavailable' })

  const result = await businessProfileService.syncFromGMB(user.id, tokens.accessToken)

  log.info({ message: 'GMB profiles synced', businessId })
  return result
})
