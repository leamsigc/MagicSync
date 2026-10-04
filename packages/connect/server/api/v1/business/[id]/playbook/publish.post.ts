import { brandPlaybookService } from '#layers/BaseDB/server/services/brand-playbook.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import z from 'zod';

const PublishSchema = z.object({
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

  const body = await readValidatedBody(event, PublishSchema.parse);

  const result = await brandPlaybookService.publish(user.id, id, body.editionId, user.email || user.id, event);

  if (!result.success) {
    log.error({ message: result.error || 'Failed to publish playbook', businessId: id })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400,
      statusMessage: result.error || 'Failed to publish playbook'
    });
  }

  log.info({ message: 'Brand playbook published', businessId: id, duplicate: result.data.duplicate })

  return result;
});
