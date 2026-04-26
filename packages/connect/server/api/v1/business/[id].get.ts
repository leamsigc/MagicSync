import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service';

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    });
  }

  const business = await businessProfileService.findById(id, user.id);
  // Get entity related to the business
  const entityDetails = await entityDetailsService.getDetailsByEntity(id, 'business_details');
  console.log(entityDetails);


  if (business.error) {
    throw createError({
      statusCode: 404,
      message: business.error
    });
  }

  return { ...business, entityDetails };
});
