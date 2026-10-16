import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { adminDataService } from '#layers/BaseDB/server/services/admin-data.service'

const AdminRowsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(200).optional(),
  sort: z.string().max(100).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

const FILTER_PREFIX = 'filter.'

function extractFilters(rawQuery: Record<string, unknown>): Record<string, string> {
  const filters: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawQuery)) {
    if (!key.startsWith(FILTER_PREFIX)) continue
    if (typeof value !== 'string') continue
    filters[key.slice(FILTER_PREFIX.length)] = value
  }
  return filters
}

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const table = getRouterParam(event, 'table') ?? ''
  const query = await getValidatedQuery(event, AdminRowsQuerySchema.parse)
  const filters = extractFilters(getQuery(event))
  const result = await adminDataService.listRows(table, { ...query, filters })
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : 500, message: result.error })
  }

  return result.data
})
