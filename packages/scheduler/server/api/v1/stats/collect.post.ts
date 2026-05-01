/**
 * POST /api/v1/stats/collect
 * Triggers stats collection for all connected social media accounts
 */
import { platformStatsService } from '#layers/BaseScheduler/server/services/PlatformStats.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const session = await getUserSessionFromEvent(event)
    if (!session?.user?.id) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event).catch(() => ({}))
    const { businessId, platform, accountId } = body

    log.set({ userId: session.user.id, businessId, platform, accountId })

    const filters: any = { userId: session.user.id }
    if (businessId) filters.businessId = businessId
    if (platform) filters.platform = platform
    if (accountId) filters.accountId = accountId

    const results = await platformStatsService.collectAllStats(filters)

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    log.set({ collected: successful, failed })

    return {
      success: true,
      data: {
        total: results.length,
        successful,
        failed,
        results,
      },
    }
  } catch (error: any) {
    log.error({ content: 'Stats collection error', error: String(error) })
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Failed to collect stats' })
  }
})
