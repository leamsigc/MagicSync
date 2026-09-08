import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"
import { auth } from '#layers/BaseAuth/lib/auth'
import { useAuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { refreshFacebookPageToken, refreshInstagramPageToken } from '#layers/BaseScheduler/server/services/TokenRefresh.service'

// NOTE: lives under /refresh/[id] and NOT /[id]/refresh — Nitro routes the
// latter to [platform]/[id]/index.post.ts (fully-dynamic 2-segment route
// shadows the static suffix), which made refresh unreachable (500s).
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    // checkUserIsLogin (Better Auth session), NOT requireUserSession
    // (nuxt-session): the latter 401s here even with a valid login, which is
    // why Reconnect always failed with "Failed to refresh token".
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const accountId = getRouterParam(event, 'id')

    if (!accountId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Account ID is required'
      })
    }

    log.set({ accountId })

    // The id may be a social_media_accounts row PK, a provider-side account
    // id (channel/page/DID, as rendered on some cards), or a Better Auth
    // row (provider cards) — resolve whichever it is.
    const smAccount = (await socialMediaAccountService.getAccountById(accountId))
      ?? await socialMediaAccountService.getAccountByProviderAccountId(user.id, accountId)

    if (smAccount && smAccount.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }

    let platform: string | null = smAccount?.platform ?? null
    let providerAccount = null

    if (!smAccount) {
      const ba = await socialMediaAccountService.getBetterAuthAccountById(accountId, user.id)
      if (!ba.success || !ba.data) {
        throw createError({
          statusCode: 404,
          statusMessage: `Social media account not found for id '${accountId}'`
        })
      }
      providerAccount = ba.data
      platform = ba.data.providerId
    }

    // Facebook has no refresh tokens: renew via token exchange + page
    // token fetch (same path the background task uses). Instagram rows hold
    // page tokens too — they renew through the sibling Page, never by
    // mirroring the Better Auth user token (that corrupts the row and Meta
    // rejects publishes with "(#200) Unpublished posts must be posted to a
    // page as the page itself").
    if (platform === 'instagram' && smAccount) {
      const renewed = await refreshInstagramPageToken(user.id, smAccount.id)
      if (renewed.error) {
        log.error({ message: 'Token refresh failed', accountId, error: renewed.error })
        await socialMediaAccountService.updateAccount(smAccount.id, { isActive: false })
        throw createError({
          statusCode: 400,
          statusMessage: 'Failed to refresh tokens. Account may need to be reconnected.'
        })
      }
      const fresh = await socialMediaAccountService.getAccountById(smAccount.id)
      log.info({ message: 'Access token refreshed', accountId, platform })
      return {
        success: true,
        message: 'Access token refreshed successfully',
        data: {
          id: smAccount.id,
          platform: smAccount.platform,
          accountName: smAccount.accountName,
          isActive: fresh?.isActive ?? true,
          lastSyncAt: fresh?.lastSyncAt ?? new Date(),
          hasValidToken: true
        }
      }
    }
    if (platform === 'facebook' && smAccount) {
      const renewed = await refreshFacebookPageToken(user.id, smAccount.id, smAccount.accountId)
      if (renewed.error) {
        log.error({ message: 'Token refresh failed', accountId, error: renewed.error })
        await socialMediaAccountService.updateAccount(smAccount.id, { isActive: false })
        throw createError({
          statusCode: 400,
          statusMessage: 'Failed to refresh tokens. Account may need to be reconnected.'
        })
      }
      const fresh = await socialMediaAccountService.getAccountById(smAccount.id)
      log.info({ message: 'Access token refreshed', accountId, platform })
      return {
        success: true,
        message: 'Access token refreshed successfully',
        data: {
          id: smAccount.id,
          platform: smAccount.platform,
          accountName: smAccount.accountName,
          isActive: fresh?.isActive ?? true,
          lastSyncAt: fresh?.lastSyncAt ?? new Date(),
          hasValidToken: true
        }
      }
    }

    try {
      // Resolve the Better Auth OAuth row. Its row id is the ONLY identifier
      // Better Auth's /get-access-token accepts — the social_media_accounts id
      // (and for YouTube, the channel id) never matches and yields
      // ACCOUNT_NOT_FOUND. Falls back to the google row: channels authorized
      // through the google provider refresh through it.
      if (!providerAccount && platform) {
        const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(
          user.id,
          platform as SocialMediaPlatform
        )
        providerAccount = resolved.success ? resolved.data : null
        if (!providerAccount && platform === 'youtube') {
          const googleFallback = await socialMediaAccountService.findBetterAuthAccountForRefresh(user.id, 'google')
          providerAccount = googleFallback.success ? googleFallback.data : null
        }
      }

      if (!providerAccount) {
        throw new Error('No linked provider account found for refresh')
      }

      // Get fresh access token using Better Auth (refreshes internally when
      // expired and persists the renewed tokens on its own row).
      const tokenResp = await auth.api.getAccessToken({
        body: { accountId: providerAccount.id },
        headers: useAuthApi(event).headers(),
      })

      if (!tokenResp?.accessToken) {
        throw new Error('Failed to retrieve access token')
      }

      // Mirror the renewed token + expiry onto our row(s). Previously only
      // isActive/lastSyncAt were written, so health kept reporting the stale
      // (expired) timestamp forever even after a successful refresh.
      const mirroredAt = new Date()
      const mirror = {
        accessToken: tokenResp.accessToken,
        tokenExpiresAt: tokenResp.accessTokenExpiresAt
          ? new Date(tokenResp.accessTokenExpiresAt)
          : undefined,
        isActive: true,
        lastSyncAt: mirroredAt,
      }
      let updatedAccount = null
      if (smAccount) {
        if (smAccount.platform === 'facebook' || smAccount.platform === 'instagram') {
          // Page-token rows must never receive the user token — that corrupts
          // them (Meta "(#200) Unpublished posts…" on publish). These platforms
          // have dedicated branches above; reaching here means the row lookup
          // disagreed with `platform`, so refuse instead of corrupting.
          throw createError({
            statusCode: 400,
            statusMessage: 'Failed to refresh tokens. Account may need to be reconnected.'
          })
        }
        // Use the resolved row PK: accountId may be a provider-side id.
        updatedAccount = await socialMediaAccountService.updateAccount(smAccount.id, mirror)
      }
      else if (platform) {
        const owned = await socialMediaAccountService.getAccountsByUserId(user.id)
        const targets = owned.filter((a) => a.platform === platform && a.platform !== 'facebook' && a.platform !== 'instagram')
        for (const target of targets) {
          updatedAccount = (await socialMediaAccountService.updateAccount(target.id, mirror)) ?? updatedAccount
        }
      }

      if (!updatedAccount) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to update account status'
        })
      }

      log.info({ message: 'Access token refreshed', accountId, platform })

      return {
        success: true,
        message: 'Access token refreshed successfully',
        data: {
          id: updatedAccount.id,
          platform: updatedAccount.platform,
          accountName: updatedAccount.accountName,
          isActive: updatedAccount.isActive,
          lastSyncAt: updatedAccount.lastSyncAt,
          hasValidToken: true
        }
      }
    } catch (refreshError) {
      log.error({ message: 'Token refresh failed', accountId, error: refreshError })

      // Mark account as inactive if refresh fails
      if (smAccount) {
        await socialMediaAccountService.updateAccount(accountId, { isActive: false })
      }

      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to refresh tokens. Account may need to be reconnected.'
      })
    }
  } catch (error) {
    log.error({ message: 'Failed to refresh social media account tokens', error })

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh account tokens'
    })
  }
})
