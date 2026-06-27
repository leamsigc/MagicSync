import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import { GoogleMyBusinessPlugin } from '#layers/BaseScheduler/server/services/plugins/googlemybusiness.plugin'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const body = await readBody(event)
  const { businessId, locationName, postData } = body
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId is required' })
  if (!locationName) throw createError({ statusCode: 400, message: 'locationName is required' })
  if (!postData) throw createError({ statusCode: 400, message: 'postData is required' })

  const business = await businessProfileService.findById(businessId, user.id)
  if (business.error) throw createError({ statusCode: 404, message: business.error })

  const gmbAccounts = await socialMediaAccountService.getAccounts({ businessId, platform: 'googlemybusiness' })
  if (!gmbAccounts.length) throw createError({ statusCode: 404, message: 'No GMB account connected' })

  const tokens = await socialMediaAccountService.getDecryptedTokens(gmbAccounts[0])
  if (!tokens.accessToken) throw createError({ statusCode: 401, message: 'GMB access token unavailable' })

  const scheduler = new SchedulerPost({})
  const plugin = new GoogleMyBusinessPlugin(scheduler)
  const result = await plugin.createPost(locationName, postData, tokens.accessToken)

  log.info({ message: 'GMB post created', businessId, locationName, topicType: postData.topicType })
  return { success: true, data: result }
})
