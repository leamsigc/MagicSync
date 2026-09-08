import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { auth } from '#layers/BaseAuth/lib/auth'
import { refreshFacebookPageToken } from '#layers/BaseScheduler/server/services/TokenRefresh.service'

export default defineTask({
  meta: {
    name: 'token:health',
    description: 'Check token health status for all active accounts and refresh expired tokens via Better Auth',
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
    let refreshedCount = 0

    for (const a of needsAttention) {
      byPlatform[a.platform] = (byPlatform[a.platform] || 0) + 1
      // Facebook has no refresh tokens (Better Auth can't renew it): renew
      // via token exchange + page token fetch instead. Page tokens obtained
      // this way don't expire, so this also ends the 6-hour failure loop.
      if (a.platform === 'facebook') {
        const renewed = await refreshFacebookPageToken(a.userId, a.id, a.accountId)
        if (renewed.error) {
          console.error(`[token:health] Failed to refresh token for ${a.platform} account ${a.id}`, renewed.error)
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
        const providerAccount = resolved.success ? resolved.data : null
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
        console.error(`[token:health] Failed to refresh token for ${a.platform} account ${a.id}`, error)
        // Mark as inactive if refresh fails — user will need to reconnect
        await socialMediaAccountService.updateAccount(a.id, { isActive: false })
      }
    }

    console.warn(
      `[token:health] ${needsAttention.length}/${accounts.length} accounts needed attention, ${refreshedCount} refreshed`,
      Object.entries(byPlatform).map(([p, c]) => `${p}: ${c}`).join(', ')
    )

    return {
      result: refreshedCount > 0 ? 'Tokens refreshed' : 'Attention needed',
      checked: accounts.length,
      needsAttention: needsAttention.length,
      refreshedCount,
      platforms: byPlatform,
    }
  },
})
