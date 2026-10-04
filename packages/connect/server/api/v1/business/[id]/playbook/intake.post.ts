import { IntakeAnswerSchema, brandPlaybookService } from '#layers/BaseDB/server/services/brand-playbook.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import z from 'zod';

const IntakeSchema = z.object({
  answers: z.array(IntakeAnswerSchema).min(1),
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

  const body = await readValidatedBody(event, IntakeSchema.parse);

  const result = await brandPlaybookService.createDraftFromIntake(user.id, id, body.answers, event);

  if (!result.success) {
    log.error({ message: result.error || 'Failed to create draft from intake', businessId: id })
    throw createError({
      statusCode: result.code === 'VALIDATION_ERROR' ? 400 : 404,
      statusMessage: result.error || 'Failed to create draft from intake'
    });
  }

  log.info({ message: 'Playbook draft created from intake', businessId: id })

  return result;
});
