import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  // Get user from session
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

  const deletedBusiness = await businessProfileService.delete(id, user.id);

  if (!deletedBusiness) {
    log.error({ message: 'Business not found or user not authorized', businessId: id })
    throw createError({
      statusCode: 404,
      statusMessage: 'Business not found or user not authorized to delete it'
    });
  }

  log.info({ message: 'Business deleted', businessId: id })

  return { message: 'Business deleted successfully' };
});
