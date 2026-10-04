import { auth } from '#layers/BaseAuth/lib/auth'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'

const getTokenForProvider = async (providerId: string, userId: string, headers: Headers): Promise<string | null> => {
  try {
    // Better Auth's /get-access-token resolves strictly by its own row id.
    // Passing only userId resolves the wrong account (usually the identity
    // login row, which has no Drive scopes) or throws on multi-account
    // users — both surface as "connected but empty list / connect still
    // visible". Resolve the provider-specific row first.
    const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(userId, providerId)
    if (!resolved.success || !resolved.data) {
      return null
    }
    // Real request headers are required: with empty headers Better Auth sees
    // an HTTP caller with no session and throws UNAUTHORIZED.
    const tokenResult = await auth.api.getAccessToken({
      body: { accountId: resolved.data.id },
      headers,
    })

    if (!tokenResult || !tokenResult.accessToken) {
      return null
    }

    return tokenResult.accessToken
  } catch (error) {
    log.error({ message: `Failed to get access token for provider ${providerId}:`, error: String(error) })
    return null
  }
}

export const getGoogleDriveToken = async (userId: string, headers: Headers): Promise<string | null> => {
  try {
    // Dedicated Drive consent (drive.readonly only — Google rejects Drive
    // scopes mixed with YouTube scopes in one request).
    const driveToken = await getTokenForProvider('google-drive', userId, headers)
    if (driveToken) {
      return driveToken
    }

    // Legacy fallback: tokens granted via the `google` provider before the
    // Drive scopes were split out still carry drive.readonly.
    return await getTokenForProvider('google', userId, headers)
  } catch (error) {
    log.error({ message: 'Failed to get Google Drive token', error: String(error) })
    return null
  }
}