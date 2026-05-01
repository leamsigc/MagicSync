import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { SetActiveBusinessSchema } from '#layers/BaseDB/db/schema';


export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const body = await readValidatedBody(event, SetActiveBusinessSchema.parse);

  log.set({ businessId: body.businessId, isActive: body.isActive })

  const newBusiness = await businessProfileService.setActive(user.id, {
    id: body.businessId,
    isActive: body.isActive
  });

  log.info('Active business set', { businessId: body.businessId, isActive: body.isActive })

  return newBusiness;
});
