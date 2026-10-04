import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'
import { verifyMachineRequest } from '#layers/BaseDB/server/utils/machine-auth'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

interface AnalyticsRequestBody {
  userId?: string
  businessId?: string
  postId?: string
  postIds?: string[]
  days?: number
  platform?: string
  limit?: number
}

function parseAnalyticsBody(raw: string): AnalyticsRequestBody | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const body = parsed as Record<string, unknown>
    return {
      userId: typeof body.userId === 'string' ? body.userId : undefined,
      businessId: typeof body.businessId === 'string' ? body.businessId : undefined,
      postId: typeof body.postId === 'string' ? body.postId : undefined,
      postIds: Array.isArray(body.postIds) && body.postIds.every(id => typeof id === 'string') ? body.postIds : undefined,
      days: typeof body.days === 'number' ? body.days : undefined,
      platform: typeof body.platform === 'string' ? body.platform : undefined,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
    }
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8') ?? ''
  const machineError = verifyMachineRequest(event, rawBody)
  if (machineError) throw createError({ statusCode: 401, statusMessage: machineError })
  const body = parseAnalyticsBody(rawBody)
  if (!body?.userId || !body.businessId) throw createError({ statusCode: 400, statusMessage: 'userId and businessId are required' })
  const membership = await businessProfileService.findById(body.businessId, body.userId, event)
  if (!membership.success) throw createError({ statusCode: 403, statusMessage: 'Business membership required' })
  const result = await analyticsService.calculateEngagement(body.userId, body.businessId, body.postIds ?? [], event)
  if (!result.success) {
    throw createError({ statusCode: 502, statusMessage: result.error })
  }
  return result
})