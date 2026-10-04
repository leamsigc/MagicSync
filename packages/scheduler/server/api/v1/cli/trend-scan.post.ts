import { authenticateMachineRequest } from "#layers/BaseDB/server/utils/machine-auth"
import { analyticsService } from "#layers/BaseDB/server/services/analytics.service"

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8') ?? ''
  const authed = await authenticateMachineRequest(event, rawBody)
  if (!authed.success || !authed.data) {
    throw createError({ statusCode: authed.code === 'NOT_FOUND' ? 404 : 401, statusMessage: authed.error })
  }
  const { userId, body } = authed.data
  const businessId = body.businessId as string
  const result = await analyticsService.getBestPosts(userId, businessId, {
    days: num(body.lookbackDays, 30),
    platform: typeof body.platform === 'string' ? body.platform : undefined,
    limit: num(body.limit, 5),
  }, event)
  if (!result.success) {
    throw createError({ statusCode: 502, statusMessage: result.error })
  }
  return result
})
