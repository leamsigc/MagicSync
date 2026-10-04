import { BrandPlaybookSchema, brandPlaybookService } from '#layers/BaseDB/server/services/brand-playbook.service';
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

  const body = await readValidatedBody(event, BrandPlaybookSchema.parse);

  const result = await brandPlaybookService.saveDraft(user.id, id, body, event);

  if (!result.success) {
    log.error({ message: result.error || 'Failed to save draft', businessId: id })
    throw createError({
      statusCode: result.code === 'VALIDATION_ERROR' ? 400 : result.code === 'FORBIDDEN' ? 403 : 404,
      statusMessage: result.error || 'Failed to save draft'
    });
  }

  log.info({ message: 'Playbook draft saved', businessId: id })

  return result;
});
