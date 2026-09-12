import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'
import { verifyMachineRequest } from '#layers/BaseDB/server/utils/machine-auth'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8') ?? ''
  const machineError = verifyMachineRequest(event, rawBody)
  if (machineError) throw createError({ statusCode: 401, statusMessage: machineError })
  const body = JSON.parse(rawBody) as { userId?: string, businessId?: string, postId?: string, postIds?: string[], days?: number, platform?: string, limit?: number }
  if (!body.userId || !body.businessId) throw createError({ statusCode: 400, statusMessage: 'userId and businessId are required' })
  const membership = await businessProfileService.findById(body.businessId, body.userId, event)
  if (!membership.success) throw createError({ statusCode: 403, statusMessage: 'Business membership required' })
  const result = await analyticsService.calculateEngagement(body.userId, body.businessId, body.postIds ?? [], event)
  if (!result.success) {
    throw createError({ statusCode: 502, statusMessage: result.error })
  }
  return result
})