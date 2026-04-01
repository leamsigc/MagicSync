import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

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

  if (business.error) {
    throw createError({
      statusCode: 404,
      message: business.error
    });
  }

  return business;
});