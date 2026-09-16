import { z } from 'zod'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

const DeleteBusinessSchema = z.object({
  reassignSocialAccountsTo: z.string().min(1).optional()
})

function statusForCode(code?: string): number {
  if (code === 'NOT_FOUND') return 404
  if (code === 'REASSIGNMENT_REQUIRED') return 409
  return 400
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  // Get user from session
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

  const body = await readBody(event).catch(() => ({}))
  const parsed = DeleteBusinessSchema.safeParse(body ?? {})
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: parsed.error.issues
    })
  }

  const result = await businessProfileService.delete(id, user.id, {
    reassignSocialAccountsTo: parsed.data.reassignSocialAccountsTo
  });

  if (!result.success) {
    log.error({ message: result.error, businessId: id, code: result.code })
    throw createError({
      statusCode: statusForCode(result.code),
      statusMessage: result.error,
      data: { code: result.code }
    });
  }

  log.info({ message: 'Business deleted', businessId: id })

  return { message: 'Business deleted successfully' };
});
