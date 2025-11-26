import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { CreateBusinessProfileSchema } from '#layers/BaseDB/db/schema';


export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const body = await readValidatedBody(event, CreateBusinessProfileSchema.parse);


  const newBusiness = await businessProfileService.create(user.id, {
    ...body,
  });

  return newBusiness;
});
