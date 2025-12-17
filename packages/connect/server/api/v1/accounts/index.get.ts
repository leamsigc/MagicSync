import { socialMediaAccountService } from "#layers/BaseDB/server/services/social-media-account.service";

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  return await socialMediaAccountService.getUserAccountsCompleteDetails(user.id);
});
