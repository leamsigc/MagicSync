import { UpdateBusinessProfileSchema } from '#layers/BaseDB/db/schema';
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { z } from 'zod';
import { ZodError } from 'zod';

const BodySchema = z.intersection(
  UpdateBusinessProfileSchema,
  z.object({
    entityDetails: z.object({
      channels: z.any().optional(),
      companyInformation: z.string().optional(),
      brandDetails: z.any().optional(),
      competitors: z.any().optional(),
      targetAudience: z.any().optional(),
    }).passthrough().optional()
  })
);

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
    body = await readValidatedBody(event, BodySchema.parse);
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

  const { entityDetails, ...profileFields } = body;
  const updatedBusiness = await businessProfileService.update(id, user.id, profileFields);

  if (!updatedBusiness.success) {
    log.error({ message: updatedBusiness.error || 'Business not found or user not authorized', businessId: id })
    throw createError({
      statusCode: 404,
      statusMessage: updatedBusiness.error || 'Business not found or user not authorized to update it'
    });
  }

  // The profile row owns only the columns; company info, brand details, channels
  // and competitors live in `entity_details` and must be merged separately.
  if (entityDetails) {
    await entityDetailsService.updateByEntity(id, 'business_details', entityDetails);
  }

  log.info({ message: 'Business profile updated', businessId: id })

  return updatedBusiness;
});
