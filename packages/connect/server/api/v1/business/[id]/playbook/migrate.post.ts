import { brandPlaybookService } from '#layers/BaseDB/server/services/brand-playbook.service';
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

  const result = await brandPlaybookService.migrateLegacy(user.id, id, event);

  if (!result.success) {
    log.error({ message: result.error || 'Failed to migrate legacy details', businessId: id })
    throw createError({
      statusCode: 404,
      statusMessage: result.error || 'Failed to migrate legacy details'
    });
  }

  log.info({ message: 'Legacy brand details migration checked', businessId: id, migrated: result.data.migrated })

  return result;
});
