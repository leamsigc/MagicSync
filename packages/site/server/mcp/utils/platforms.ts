import { z } from 'zod'

/**
 * Canonical platform IDs. MUST match the `platform` enum on
 * `socialMediaAccounts` (packages/db/db/socialMedia/socialMedia.ts).
 * Tool schemas validate against these; resolveAccounts() maps them to
 * social-account IDs (PostService.targetPlatforms takes ACCOUNT IDs).
 */
export const PLATFORMS = z.enum([
  'facebook',
  'instagram',
  'instagram-standalone',
  'twitter',
  'tiktok',
  'google',
  'googlemybusiness',
  'discord',
  'linkedin',
  'linkedin-page',
  'threads',
  'youtube',
  'bluesky',
  'devto',
  'dribbble',
  'reddit',
  'wordpress',
] as const)

export type PlatformId = z.infer<typeof PLATFORMS>
