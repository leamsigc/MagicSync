import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { CreateBusinessProfileSchema, businessProfiles } from '#layers/BaseDB/db/schema';
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails';
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
import { z } from 'zod';

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

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event);

  const body = await readValidatedBody(event, BodySchema.parse);

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
    const db = useDrizzle();
    await db.insert(entityDetails).values({
      id: crypto.randomUUID(),
      entityId: newBusiness.data.id,
      entityType: 'business_details',
      details: body.entityDetails as any
    });
  }

  return newBusiness;
});
