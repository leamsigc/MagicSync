import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service';

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const params = getQuery(event)
  const id = event.context.params?.id || params.id
  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing business id' })
  }

  const result = await businessProfileService.findById(id, user.id)
  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  const business = result.data

  // try to load entity details for this business (optional)
  try {
    const details = await entityDetailsService.getDetailsByEntity(id, 'business_profile')
    // attach if found
    if (details) {
      // @ts-ignore
      business.entityDetail = details
    }
  } catch (err) {
    // ignore missing entity details
    console.error('Failed to load entity details for business', id, err)
  }

  return business
})
