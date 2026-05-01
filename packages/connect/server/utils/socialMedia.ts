import type { H3Event } from 'h3'
import { auth } from '#layers/BaseAuth/lib/auth'
import { useAuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'
import type { SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service'

/**
 * Start OAuth flow by redirecting client to provider's authorization page.
 * This is a server-side redirect — no session headers needed.
 */
export function getAuthUrl(platform: SocialMediaPlatform, callbackUrl?: string) {
  return auth.api.signInSocial({
    body: { provider: platform, callbackURL: callbackUrl }
  })
}

/**
 * Check if platform is supported by Better Auth (native or Generic OAuth).
 */
export function isBetterAuthPlatform(platform: SocialMediaPlatform): boolean {
  const betterAuthPlatforms: SocialMediaPlatform[] = [
    'facebook',
    'instagram',
    'threads',
    'google',
    'googlemybusiness',
    'reddit',
    'discord',
    'linkedin',
    'twitter',
    'tiktok',
    'linkedin-page',
    'youtube',
    'dribbble'
  ]
  return betterAuthPlatforms.includes(platform)
}

/**
 * Link a social account to the current authenticated user.
 * Headers auto-extracted from event via useAuthApi.
 */
export function linkAccount(event: H3Event, platform: SocialMediaPlatform, callbackUrl?: string) {
  return useAuthApi(event).linkSocialAccount({
    body: {
      provider: platform,
      callbackURL: callbackUrl
    }
  })
}

/**
 * Exchange code and retrieve tokens + user info.
 * Better Auth handles this internally.
 */
export async function getAccountInfo(event: H3Event, accountId: string) {
  return useAuthApi(event).accountInfo({ body: { accountId } })
}

/**
 * Fetch a valid access token for an existing linked account.
 * Automatically refreshes if needed.
 */
export async function getAccessToken(event: H3Event, provider: SocialMediaPlatform, accountId?: string) {
  const resp = await useAuthApi(event).getAccessToken({
    body: { providerId: provider, accountId }
  })
  return resp.accessToken
}

export interface PlatformUserInfo {
  id: string | undefined
  name: string
  username: string | undefined
  email: string | undefined
  profilePicture: string | undefined
}

/**
 * Fetch user profile from linked account.
 */
export async function getUserInfo(event: H3Event, provider: SocialMediaPlatform, accountId: string): Promise<PlatformUserInfo> {
  const info = await useAuthApi(event).accountInfo({ body: { accountId } })
  return {
    id: info?.user.id,
    name: info?.user.name ?? '',
    username: info?.user?.name ?? undefined,
    email: info?.user?.email ?? undefined,
    profilePicture: info?.user?.image ?? undefined
  }
}
