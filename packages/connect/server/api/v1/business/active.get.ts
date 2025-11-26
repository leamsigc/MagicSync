import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"


export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)


  return await businessProfileService.getActive(user.id);
});
