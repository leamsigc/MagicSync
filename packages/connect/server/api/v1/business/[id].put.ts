import { UpdateBusinessProfileSchema, type BusinessProfile } from '#layers/BaseDB/db/schema';
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { ZodError } from 'zod';

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

  let body;
  try {
    body = await readValidatedBody(event, UpdateBusinessProfileSchema.parse);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors = e.issues.map((err: { path: any[]; message: any; }) => ({
        field: err.path.join('.'),
        message: err.message
      }));
      log.error({ message: 'Validation error', errors: fieldErrors })
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Error',
        data: {
          name: 'ValidationError',
          message: 'Invalid request data',
          errors: fieldErrors
        }
      });
    }
    throw e;
  }

  const updatedBusiness = await businessProfileService.update(id, user.id, body);

  if (!updatedBusiness.success) {
    log.error({ message: updatedBusiness.error || 'Business not found or user not authorized', businessId: id })
    throw createError({
      statusCode: 404,
      statusMessage: updatedBusiness.error || 'Business not found or user not authorized to update it'
    });
  }

  log.info({ message: 'Business profile updated', businessId: id })

  return updatedBusiness;
});
