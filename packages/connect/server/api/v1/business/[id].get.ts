import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service';

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event);
  log.set({ userId: user.id })

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    });
  }

  log.set({ businessId: id })

  const business = await businessProfileService.findById(id, user.id);
  // Get entity related to the business
  const entityDetails = await entityDetailsService.getDetailsByEntity(id, 'business_details');

  if (business.error) {
    log.error('Business not found or access denied', { businessId: id })
    throw createError({
      statusCode: 404,
      message: business.error
    });
  }

  log.info('Business profile retrieved', { businessId: id })

  return { ...business, entityDetails };
});
