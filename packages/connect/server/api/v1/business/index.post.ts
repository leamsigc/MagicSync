import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { CreateBusinessProfileSchema, } from '#layers/BaseDB/db/schema';
import { z } from 'zod';
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service';

const BodySchema = z.intersection(
  CreateBusinessProfileSchema,
  z.object({
    entityDetails: z.object({
      channels: z.any().optional(),
      companyInformation: z.string().optional(),
      brandDetails: z.any().optional(),
    }).passthrough().optional()
  })
);
export type BodySchemaCreateBusinessType = z.infer<typeof BodySchema>;
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event);
  log.set({ userId: user.id })

  const body = await readValidatedBody(event, BodySchema.parse);

  log.set({ businessName: body.name })

  const newBusiness = await businessProfileService.create(user.id, {
    name: body.name,
    description: body.description,
    address: body.address,
    phone: body.phone,
    website: body.website,
    category: body.category,
    googleBusinessId: body.googleBusinessId,
  });

  if (body.entityDetails && newBusiness.data) {
    const entityDetails = entityDetailsService.createDetails({
      entityType: 'business_details',
      entityId: newBusiness.data.id,
      details: JSON.stringify(body.entityDetails) as any,
    })
  }

  log.info('Business profile created', { businessId: newBusiness.data?.id })

  return newBusiness;
});
