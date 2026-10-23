import { socialMediaAccountService, sanitizeSocialMediaAccount } from '#layers/BaseDB/server/services/social-media-account.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

interface AccountHealth {
  status: string
}

function countByStatus(accounts: Array<{ health: AccountHealth }>, status: string): number {
  return accounts.filter(account => account.health.status === status).length
}

function buildSummary(accounts: Array<{ health: AccountHealth }>) {
  return {
    total: accounts.length,
    healthy: countByStatus(accounts, 'healthy'),
    expiringSoon: countByStatus(accounts, 'expiring_soon'),
    expired: countByStatus(accounts, 'expired'),
    unknown: countByStatus(accounts, 'unknown'),
    needsAttention: countByStatus(accounts, 'expired') + countByStatus(accounts, 'expiring_soon'),
  }
}

/**
 * `?summary=1` returns only the fields the notification/badge needs.
 * The default response keeps the full account rows for the integrations page;
 * that payload is ~400 KB and is deliberately not what the dashboard layout
 * requests on every page load.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const { summary: summaryOnly } = getQuery(event)

  const accounts = await socialMediaAccountService.getAccountsByUserId(user.id)

  const accountsWithHealth = accounts.map(account => ({
    ...sanitizeSocialMediaAccount(account),
    health: socialMediaAccountService.getTokenHealth(account)
  }))

  const payload = summaryOnly === '1'
    ? accountsWithHealth.map(({ id, platform, accountName, health }) => ({ id, platform, accountName, health }))
    : accountsWithHealth

  return { accounts: payload, summary: buildSummary(accountsWithHealth) }
})

