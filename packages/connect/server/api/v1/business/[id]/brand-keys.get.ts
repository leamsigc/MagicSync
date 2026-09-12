import { businessCorpusService } from '#layers/BaseDB/server/services/business-corpus.service';
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

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

  const access = await requireBusinessAccess(event, user.id, id);
  if (!access.success || !access.data) {
    throw createError({
      statusCode: accessErrorStatus(access.code),
      statusMessage: access.error || 'Business not found'
    });
  }

  const result = await businessCorpusService.getBrandKeys(id, access.data.ownerUserId);

  log.info({ message: 'Business brand keys retrieved', businessId: id })

  return result;
});
