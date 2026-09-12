import { brandPlaybookService } from '#layers/BaseDB/server/services/brand-playbook.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import z from 'zod';

const RestoreSchema = z.object({
  editionId: z.string().min(1),
});

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

  const body = await readValidatedBody(event, RestoreSchema.parse);

  const result = await brandPlaybookService.restoreAsDraft(user.id, id, body.editionId, event);

  if (!result.success) {
    log.error({ message: result.error || 'Failed to restore playbook', businessId: id })
    throw createError({
      statusCode: result.code === 'VALIDATION_ERROR' ? 400 : 404,
      statusMessage: result.error || 'Failed to restore playbook'
    });
  }

  log.info({ message: 'Playbook edition restored as draft', businessId: id })

  return result;
});
