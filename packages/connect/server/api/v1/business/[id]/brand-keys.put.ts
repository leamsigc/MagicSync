import { BrandKeySchema } from '#layers/BaseDB/db/schema';
import { businessCorpusService } from '#layers/BaseDB/server/services/business-corpus.service';
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import z from 'zod';

const BrandKeyPutSchema = z.object({
  key: BrandKeySchema,
  content: z.string(),
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

  const body = await readValidatedBody(event, BrandKeyPutSchema.parse);

  const access = await requireBusinessAccess(event, user.id, id);
  if (!access.success || !access.data) {
    throw createError({
      statusCode: accessErrorStatus(access.code),
      statusMessage: access.error || 'Business not found'
    });
  }

  const result = await businessCorpusService.upsertBrandKey(access.data.ownerUserId, {
    businessId: id,
    key: body.key,
    content: body.content,
  });

  if (!result.success) {
    log.error({ message: result.error || 'Failed to save brand key', businessId: id })
    throw createError({
      statusCode: 400,
      statusMessage: result.error || 'Failed to save brand key'
    });
  }

  log.info({ message: 'Business brand key saved', businessId: id })

  return result;
});
