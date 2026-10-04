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

  const query = getQuery(event)
  const editionId = typeof query.editionId === 'string' ? query.editionId : undefined

  const result = editionId
    ? await brandPlaybookService.listEditions(user.id, id, event).then((res) => {
      if (!res.success || !res.data) return res
      const edition = res.data.find(item => item.id === editionId) ?? null
      if (!edition) {
        return { success: false as const, error: 'Playbook edition not found', code: 'NOT_FOUND' }
      }
      return { success: true as const, data: edition }
    })
    : await brandPlaybookService.getCurrent(user.id, id, event);

  if (!result.success) {
    log.error({ message: result.error || 'Failed to export playbook', businessId: id })
    throw createError({
      statusCode: 404,
      statusMessage: result.error || 'Failed to export playbook'
    });
  }

  return {
    success: true,
    data: {
      format: 'magicsync-playbook/v1',
      exportedAt: new Date().toISOString(),
      edition: result.data,
    },
  };
});
