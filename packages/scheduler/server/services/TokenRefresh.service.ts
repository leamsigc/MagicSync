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
  return plugin as unknown as FacebookPlugin
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
