import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { goalRunService } from '#layers/BaseDB/server/services/goal-run.service'

/**
 * Authoritative snapshot of one goal run: status, plan and step states with
 * JSON fields parsed for the client.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'id') ?? ''
  const loaded = await goalRunService.get(user.id, runId)
  if (!loaded.success) {
    throw createError({ statusCode: loaded.code === 'NOT_FOUND' ? 404 : 500, statusMessage: loaded.error })
  }
  return {
    id: loaded.data.id,
    goal: loaded.data.goal,
    status: loaded.data.status,
    businessId: loaded.data.businessId,
    plan: safeJson(loaded.data.plan),
    steps: safeJson(loaded.data.steps),
    result: safeJson(loaded.data.result ?? null),
    error: loaded.data.error,
    createdAt: loaded.data.createdAt,
    completedAt: loaded.data.completedAt,
  }
})

function safeJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
