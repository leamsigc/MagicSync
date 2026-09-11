import { auth } from '#layers/BaseAuth/lib/auth'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import { FacebookPlugin } from '#layers/BaseScheduler/server/services/plugins/facebook.plugin'

/**
 * TokenRefresh service — provider-specific renewal that Better Auth can't
 * do on its own. All methods return ServiceResponse and never throw.
 *
 * Facebook has no refresh tokens, so renewal = short/long-lived user token
 * exchange + fresh page token fetch (see FacebookPlugin.refreshPageToken).
 * Page tokens obtained this way don't expire.
 */
async function facebookPlugin(): Promise<FacebookPlugin> {
  const scheduler = new SchedulerPost({})
  scheduler.use(FacebookPlugin)
  const plugin = scheduler.getPlugin('facebook')
  if (!plugin) throw new Error('Facebook plugin not registered')
  return plugin as FacebookPlugin
}

/**
 * Platforms whose social_media_accounts rows hold PAGE tokens (minted via
 * fetchPageInformation), not user tokens. Mirroring a Better Auth user token
 * onto these rows breaks publishing — Meta rejects e.g. unpublished photo
 * uploads with "(#200) Unpublished posts must be posted to a page as the
 * page itself". Every renewal path must go through the page-token functions
 * below, never a blind user-token mirror.
 */
export const PAGE_TOKEN_PLATFORMS: ReadonlySet<string> = new Set(['facebook', 'instagram'])

export function usesPageToken(platform: string): boolean {
  return PAGE_TOKEN_PLATFORMS.has(platform)
}

/**
 * Page tokens renewed through refreshPageToken are stored with
 * tokenExpiresAt=null (non-expiring). A present near-term expiry therefore
 * means a user token was mirrored here by mistake → needs healing.
 */
export function needsPageTokenRenewal(row: { accessToken?: string | null; tokenExpiresAt?: Date | null }): boolean {
  if (!row.accessToken) return true
  if (!row.tokenExpiresAt) return false
  return new Date(row.tokenExpiresAt).getTime() < Date.now() + 24 * 60 * 60 * 1000
}

/**
 * Renew an INSTAGRAM row's page token. IG rows store the Page's token (see
 * fetchPageInformation), so renewal needs the sibling Facebook Page id.
 */
export async function refreshInstagramPageToken(
  userId: string,
  rowId: string
): Promise<ServiceResponse<{ renewed: boolean }>> {
  try {
    const siblings = await socialMediaAccountService.getAccounts({ userId, platform: 'facebook' })
    const page = siblings.find((s) => s.accessToken)
    if (!page) {
      return { success: false, error: 'No Facebook Page with a token found — reconnect the Facebook Page first' }
    }
    const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(userId, 'facebook')
    const providerAccount = resolved.success ? resolved.data : null
    if (!providerAccount) {
      return { success: false, error: 'No linked provider account found for refresh' }
    }
    const tokenResp = await auth.api.getAccessToken({
      body: { accountId: providerAccount.id, userId },
    })
    const userToken = (tokenResp as { accessToken?: string })?.accessToken
    if (!userToken) {
      return { success: false, error: 'Failed to retrieve access token' }
    }
    const plugin = await facebookPlugin()
    const { pageAccessToken } = await plugin.refreshPageToken(page.accountId, userToken)
    await socialMediaAccountService.updateAccount(rowId, {
      accessToken: pageAccessToken,
      tokenExpiresAt: null,
      isActive: true,
      lastSyncAt: new Date(),
    })
    return { success: true, data: { renewed: true } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to refresh Instagram token' }
  }
}

/**
 * Single entry point for renewing a social_media_accounts row. Page-token
 * platforms renew via exchange (skipped when the stored token is healthy);
 * anything else returns not-applicable so callers keep their user-token path.
 */
export async function renewRowToken(
  row: { id: string; userId: string; platform: string; accountId: string; accessToken?: string | null; tokenExpiresAt?: Date | null }
): Promise<ServiceResponse<{ renewed: boolean }>> {
  try {
    if (!usesPageToken(row.platform)) {
      return { success: false, error: 'Not a page-token platform', code: 'NOT_APPLICABLE' }
    }
    if (!needsPageTokenRenewal(row)) {
      return { success: true, data: { renewed: false } }
    }
    if (row.platform === 'facebook') {
      return refreshFacebookPageToken(row.userId, row.id, row.accountId)
    }
    return refreshInstagramPageToken(row.userId, row.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to renew row token' }
  }
}

export async function refreshFacebookPageToken(
  userId: string,
  rowId: string,
  pageId: string
): Promise<ServiceResponse<{ renewed: boolean }>> {
  try {
    const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(userId, 'facebook')
    const providerAccount = resolved.success ? resolved.data : null
    if (!providerAccount) {
      return { success: false, error: 'No linked provider account found for refresh' }
    }
    // No `headers`: trusted server-side call, explicit userId is accepted.
    // Returns the decrypted stored user token (even if expired — the
    // exchange below is what renews it).
    const tokenResp = await auth.api.getAccessToken({
      body: { accountId: providerAccount.id, userId },
    })
    const userToken = (tokenResp as { accessToken?: string })?.accessToken
    if (!userToken) {
      return { success: false, error: 'Failed to retrieve access token' }
    }
    const plugin = await facebookPlugin()
    const { pageAccessToken } = await plugin.refreshPageToken(pageId, userToken)
    await socialMediaAccountService.updateAccount(rowId, {
      accessToken: pageAccessToken,
      tokenExpiresAt: null,
      isActive: true,
      lastSyncAt: new Date(),
    })
    return { success: true, data: { renewed: true } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to refresh Facebook token' }
  }
}
