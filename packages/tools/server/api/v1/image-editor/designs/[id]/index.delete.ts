import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

/** Delete a design (owner-only). */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const result = await designService.delete(id, principal.userId)
  if (!result.success) {
    throw createError({ statusCode: result.error === 'Design not found' ? 404 : 500, statusMessage: result.error ?? 'Failed to delete design' })
  }
  return result.data
})
