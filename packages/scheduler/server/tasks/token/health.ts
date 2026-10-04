import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { auth } from '#layers/BaseAuth/lib/auth'
import { refreshFacebookPageToken, refreshInstagramPageToken } from '#layers/BaseDB/server/services/TokenRefresh.service'

// Short-lived OAuth (YouTube/Google 1h access tokens) renewed from a stored
// refresh token. Renewed proactively inside this window so rows don't sit
// Expired between task runs (cadence below is 6h).
const SHORT_LIVED_PLATFORMS: ReadonlySet<string> = new Set(['google', 'googlemybusiness', 'youtube'])
const PROACTIVE_RENEW_BEFORE_MS = 7 * 60 * 60 * 1000

function msUntilExpiry(expiresAt: unknown): number | null {
  if (!expiresAt) return null
  // social_media_accounts stores seconds-epoch (drizzle timestamp mode);
  // tolerate ms numbers and Date-likes from other call shapes.
  const asMs = typeof expiresAt === 'number'
    ? (expiresAt < 1e12 ? expiresAt * 1000 : expiresAt)
    : new Date(expiresAt as string | Date).getTime()
  if (Number.isNaN(asMs)) return null
  return asMs - Date.now()
}

export default defineTask({
  meta: {
    name: 'token:health',
    description: 'Check token health status for all active accounts and refresh expired tokens via Better Auth',
  },
  async run({ payload, context }) {
    const accounts = await socialMediaAccountService.getAccounts({ isActive: true })

    const needsAttention = accounts.filter(a => {
      const health = socialMediaAccountService.getTokenHealth(a)
      if (health.status === 'expired' || health.status === 'expiring_soon') return true
      // Proactive: a 1h YouTube token would otherwise report Expired for
      // most of the 6h cadence even though its refresh token is fine.
      if (SHORT_LIVED_PLATFORMS.has(a.platform)) {
        const left = msUntilExpiry(a.tokenExpiresAt)
        if (left !== null && left < PROACTIVE_RENEW_BEFORE_MS) return true
      }
      return false
    })

    if (needsAttention.length === 0) {
      return { result: 'All tokens healthy', checked: accounts.length }
    }

    const byPlatform: Record<string, number> = {}
    let refreshedCount = 0

    for (const a of needsAttention) {
      byPlatform[a.platform] = (byPlatform[a.platform] || 0) + 1
      // Facebook has no refresh tokens (Better Auth can't renew it): renew
      // via token exchange + page token fetch instead. Page tokens obtained
      // this way don't expire, so this also ends the 6-hour failure loop.
      // Instagram rows hold page tokens too — mirroring the Better Auth user
      // token here would corrupt them (Meta then rejects publishes with
      // "(#200) Unpublished posts must be posted to a page as the page itself").
      if (a.platform === 'facebook' || a.platform === 'instagram') {
        const renewed = a.platform === 'facebook'
          ? await refreshFacebookPageToken(a.userId, a.id, a.accountId)
          : await refreshInstagramPageToken(a.userId, a.id)
        if (renewed.error) {
          log.error({ message: `[token:health] Failed to refresh token for ${a.platform} account ${a.id}`, detail: renewed.error })
          await socialMediaAccountService.updateAccount(a.id, { isActive: false })
        } else {
          refreshedCount++
        }
        continue
      }
      try {
        // Resolve the Better Auth row id first: passing our own account id
        // (or the provider account id) never matches and throws
        // ACCOUNT_NOT_FOUND.
        const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(
          a.userId,
          a.platform
        )
        let providerAccount = resolved.success ? resolved.data : null
        // YouTube channels authorized via the `google` provider (which
        // carries youtube.force-ssl) refresh through the google account —
        // same fallback as the manual refresh endpoint and ScheduleUtils.
        if (!providerAccount && a.platform === 'youtube') {
          const googleFallback = await socialMediaAccountService.findBetterAuthAccountForRefresh(a.userId, 'google')
          providerAccount = googleFallback.success ? googleFallback.data : null
        }
        if (!providerAccount) {
          throw new Error('No linked provider account found for refresh')
        }
        // Use Better Auth to refresh token — it handles provider-specific logic,
        // PKCE, and client credentials internally. userId is passed because
        // background jobs have no session headers.
        // No `headers`: even empty Headers make Better Auth treat this as an
        // HTTP caller and throw UNAUTHORIZED with no session. Omitted, the
        // explicit userId below is accepted for trusted server-side calls.
        const tokenResp = await auth.api.getAccessToken({
          body: {
            accountId: providerAccount.id,
            userId: a.userId,
          },
        })

        const freshToken = (tokenResp as any)?.accessToken
        const freshRefreshToken = (tokenResp as any)?.refreshToken
        const expiresAt = (tokenResp as any)?.accessTokenExpiresAt
        if (freshToken) {
          // Mirror the renewed tokens onto our row. Previously only
          // isActive/lastSyncAt/tokenExpiresAt were written, so plugins kept
          // using the stale (expired) access token forever.
          await socialMediaAccountService.updateAccount(a.id, {
            accessToken: freshToken,
            ...(freshRefreshToken ? { refreshToken: freshRefreshToken } : {}),
            isActive: true,
            lastSyncAt: new Date(),
            ...(expiresAt ? { tokenExpiresAt: new Date(expiresAt) } : {}),
          })
          refreshedCount++
        }
      } catch (error) {
        log.error({ message: `[token:health] Failed to refresh token for ${a.platform} account ${a.id}`, error: String(error) })
        // Never deactivate a still-valid token on a transient refresh
        // failure — it keeps working until its real expiry and the next tick
        // retries. Only expired rows get parked for reconnect.
        const left = msUntilExpiry(a.tokenExpiresAt)
        if (left === null || left <= 0) {
          await socialMediaAccountService.updateAccount(a.id, { isActive: false })
        }
      }
    }

    log.warn({ message: `[token:health] ${needsAttention.length}/${accounts.length} accounts needed attention, ${refreshedCount} refreshed`, detail: Object.entries(byPlatform).map(([p, c]) => `${p}: ${c}`).join(', ') })

    return {
      result: refreshedCount > 0 ? 'Tokens refreshed' : 'Attention needed',
      checked: accounts.length,
      needsAttention: needsAttention.length,
      refreshedCount,
      platforms: byPlatform,
    }
  },
})
