/**
 * GET /api/v1/templates - List templates for authenticated user
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { templateService } from "#layers/BaseDB/server/services/template.service"
import { TemplateType } from "#layers/BaseDB/db/schema"
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'

function parseTemplateFilters(query: Record<string, unknown>): Record<string, unknown> {
  const filters: Record<string, unknown> = {}
  if (query.type && TemplateType.includes(query.type as typeof TemplateType[number])) {
    filters.type = query.type as string
  }
  if (query.isPublic !== undefined) {
    filters.isPublic = query.isPublic === 'true'
  }
  if (query.unattached === 'true') {
    filters.unattached = true
  }
  return filters
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Get query parameters
    const query = getQuery(event)
    const businessId = typeof query.businessId === 'string' ? query.businessId : undefined

    // Parse pagination parameters
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 20

    const filters = parseTemplateFilters(query)

    if (businessId) {
      const access = await requireBusinessAccess(event, user.id, businessId)
      if (!access.success) {
        throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
      }
    }

    log.info('Templates retrieved', { page, limit, filters, businessId })

    const result = await templateService.findByOwner(user.id, {
      pagination: { page, limit },
      filters
    }, businessId)

    return result
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string }
    if (err.statusCode) {
      throw error
    }

    log.error('Failed to retrieve templates', { error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
