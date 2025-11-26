import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { SetActiveBusinessSchema } from '#layers/BaseDB/db/schema';


export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const body = await readValidatedBody(event, SetActiveBusinessSchema.parse);


  const newBusiness = await businessProfileService.setActive(user.id, {
    id: body.businessId,
    isActive: body.isActive
  });

  return newBusiness;
});
