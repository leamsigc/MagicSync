/**
 * POST /api/v1/stats/collect
 * Triggers stats collection for all connected social media accounts.
 * Due-gated by default (sync-state); passes `force: true` in the body to
 * collect everything immediately (classic "refresh now" behavior).
 */
import { statsCollectorService } from '#layers/BaseScheduler/server/services/StatsCollector.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const user = await checkUserIsLogin(event)

    const body = await readBody(event).catch(() => ({}))
    const { businessId, platform, accountId, force = false } = body

    log.set({ userId: user.id, businessId, platform, accountId, force })

    const filters: any = { userId: user.id }
    if (businessId) filters.businessId = businessId
    if (platform) filters.platform = platform
    if (accountId) filters.accountId = accountId

    const result = await statsCollectorService.collectAllDue(filters, { force: !!force })

    log.set({ accountsDue: result.accountsDue, postsDue: result.postsDue })

    return {
      success: true,
      data: {
        total: result.accountsDue + result.postsDue,
        successful: result.accountsCollected + result.postsCollected,
        failed: result.accountsFailed + result.postsFailed,
        accountsDue: result.accountsDue,
        accountsCollected: result.accountsCollected,
        accountsFailed: result.accountsFailed,
        postsDue: result.postsDue,
        postsCollected: result.postsCollected,
        postsFailed: result.postsFailed,
        results: result.results,
      },
    }
  } catch (error: any) {
    log.error({ content: 'Stats collection error', error: String(error) })
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Failed to collect stats' })
  }
})
