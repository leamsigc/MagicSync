import { socialMediaAccountService } from "#layers/BaseDB/server/services/social-media-account.service";

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const result = await socialMediaAccountService.getUserAccountsCompleteDetails(user.id);

  log.info({ message: 'User accounts retrieved', accountCount: result.length })

  return result;
});
