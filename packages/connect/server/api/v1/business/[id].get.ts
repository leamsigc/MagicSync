import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service';
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access';

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event);
  log.set({ userId: user.id })

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Business ID is required'
    });
  }

  log.set({ businessId: id })

  const access = await requireBusinessAccess(event, user.id, id);
  if (!access.success || !access.data) {
    log.error({ message: 'Business not found or access denied', businessId: id })
    throw createError({
      statusCode: accessErrorStatus(access.code),
      message: access.error
    });
  }

  const entityDetails = await entityDetailsService.getDetailsByEntity(id, 'business_details');

  log.info({ message: 'Business profile retrieved', businessId: id, role: access.data.role })

  return { data: access.data.business, entityDetails, role: access.data.role };
});
