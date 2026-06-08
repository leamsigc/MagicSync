import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const accounts = await socialMediaAccountService.getAccountsByUserId(user.id)

  const accountsWithHealth = accounts.map(account => ({
    ...account,
    health: socialMediaAccountService.getTokenHealth(account)
  }))

  const summary = {
    total: accountsWithHealth.length,
    healthy: accountsWithHealth.filter(a => a.health.status === 'healthy').length,
    expiringSoon: accountsWithHealth.filter(a => a.health.status === 'expiring_soon').length,
    expired: accountsWithHealth.filter(a => a.health.status === 'expired').length,
    unknown: accountsWithHealth.filter(a => a.health.status === 'unknown').length,
    needsAttention: accountsWithHealth.filter(a => a.health.status === 'expired' || a.health.status === 'expiring_soon').length,
  }

  return { accounts: accountsWithHealth, summary }
})
