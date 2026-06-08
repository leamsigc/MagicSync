import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'

export default defineTask({
  meta: {
    name: 'token:health',
    description: 'Check token health status for all active accounts and log accounts that need attention',
  },
  async run({ payload, context }) {
    const accounts = await socialMediaAccountService.getAccounts({ isActive: true })

    const needsAttention = accounts.filter(a => {
      const health = socialMediaAccountService.getTokenHealth(a)
      return health.status === 'expired' || health.status === 'expiring_soon'
    })

    if (needsAttention.length === 0) {
      return { result: 'All tokens healthy', checked: accounts.length }
    }

    const byPlatform: Record<string, number> = {}
    for (const a of needsAttention) {
      byPlatform[a.platform] = (byPlatform[a.platform] || 0) + 1
    }

    console.warn(
      `[token:health] ${needsAttention.length}/${accounts.length} accounts need attention:`,
      Object.entries(byPlatform).map(([p, c]) => `${p}: ${c}`).join(', ')
    )

    return {
      result: 'Attention needed',
      checked: accounts.length,
      needsAttention: needsAttention.length,
      platforms: byPlatform,
    }
  },
})
