import { UpdateBusinessProfileSchema, type BusinessProfile } from '#layers/BaseDB/db/schema';
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })


  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Business ID is required'
    });
  }

  log.set({ businessId: id })

  const body = await readValidatedBody(event, UpdateBusinessProfileSchema.parse);

  const updatedBusiness = await businessProfileService.update(id, user.id, body);

  if (!updatedBusiness) {
    log.error('Business not found or user not authorized', { businessId: id })
    throw createError({
      statusCode: 404,
      statusMessage: 'Business not found or user not authorized to update it'
    });
  }

  log.info('Business profile updated', { businessId: id })

  return updatedBusiness;
});
