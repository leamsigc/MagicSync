import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const query = getQuery(event)
  const businessId = query.businessId as string
  const locationId = decodeURIComponent(getRouterParam(event, 'locationId') || '')
  if (!businessId || !locationId) throw createError({ statusCode: 400, message: 'businessId query param and locationId route param required' })

  const business = await businessProfileService.findById(businessId, user.id)
  if (business.error) throw createError({ statusCode: 404, message: business.error })

  const gmbAccounts = await socialMediaAccountService.getAccounts({ businessId, platform: 'googlemybusiness' })
  if (!gmbAccounts.length) throw createError({ statusCode: 404, message: 'No GMB account connected' })

  const tokens = await socialMediaAccountService.getDecryptedTokens(gmbAccounts[0])
  if (!tokens.accessToken) throw createError({ statusCode: 401, message: 'GMB access token unavailable' })

  const body = await readBody(event)

  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=${body.updateMask || 'profile.description'}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body.locationData || body),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw createError({ statusCode: response.status, message: `GMB API error: ${errText}` })
  }

  const result = await response.json()
  log.info('GMB location updated', { businessId, locationId })
  return { success: true, data: result }
})
