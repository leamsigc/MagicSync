import { socialMediaAccountService, type SocialMediaPlatform } from "#layers/BaseDB/server/services/social-media-account.service"
import { getAccessToken } from "#layers/BaseConnect/server/utils/socialMedia"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"

// NOTE: lives under /validate/[id] and NOT /[id]/validate — Nitro routes the
// latter to [platform]/[id]/index.post.ts (fully-dynamic 2-segment route
// shadows the static suffix), which made validation unreachable (500s).
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    // checkUserIsLogin (Better Auth session), NOT requireUserSession
    // (nuxt-session): the latter 401s here even with a valid login.
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

    // The id may be a social_media_accounts row (page cards) or a Better Auth
    // row (provider cards) — resolve whichever it is.
    const smAccount = await socialMediaAccountService.getAccountById(accountId)

    if (smAccount && smAccount.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }

    let platform: string | null = smAccount?.platform ?? null
    let providerAccountId: string | null = null

    if (!smAccount) {
      const ba = await socialMediaAccountService.getBetterAuthAccountById(accountId, user.id)
      if (!ba.success || !ba.data) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Social media account not found'
        })
      }
      providerAccountId = ba.data.id
      platform = ba.data.providerId
    }
    else {
      const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(
        user.id,
        platform as SocialMediaPlatform
      )
      let providerAccount = resolved.success ? resolved.data : null
      if (!providerAccount && platform === 'youtube') {
        const googleFallback = await socialMediaAccountService.findBetterAuthAccountForRefresh(user.id, 'google')
        providerAccount = googleFallback.success ? googleFallback.data : null
      }
      if (!providerAccount) {
        throw new Error('No linked provider account found')
      }
      providerAccountId = providerAccount.id
    }

    // Validate the account connection using Better Auth
    let isValid = false
    let needsRefresh = false

    try {
      // Try to get a valid access token - Better Auth will handle refresh if needed
      const accessToken = await getAccessToken(event, platform as SocialMediaPlatform, providerAccountId)
      isValid = !!accessToken

      // Update account status if validation successful
      if (isValid && smAccount) {
        await socialMediaAccountService.updateAccount(accountId, {
          isActive: true,
          lastSyncAt: new Date()
        })
      }
    } catch (error) {
      log.error({ message: 'Token validation failed', accountId, error })
      isValid = false
      needsRefresh = true

      // Mark account as inactive if validation fails
      if (smAccount) {
        await socialMediaAccountService.updateAccount(accountId, {
          isActive: false
        })
      }
    }

    log.info({ message: 'Social media account validated', accountId, isValid, needsRefresh })

    return {
      success: true,
      data: {
        accountId,
        platform,
        accountName: smAccount?.accountName ?? null,
        isValid,
        needsRefresh,
        isActive: isValid ? true : false,
        lastSyncAt: smAccount?.lastSyncAt ?? null,
        validatedAt: new Date()
      }
    }
  } catch (error) {
    log.error({ message: 'Failed to validate social media account', error })

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to validate social media account'
    })
  }
})
