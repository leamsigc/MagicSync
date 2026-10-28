import sharp from 'sharp';
import { promises as fs } from 'node:fs'
import { getAccessTokenHelper } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { usesPageToken, renewRowToken } from '#layers/BaseDB/server/services/TokenRefresh.service';
import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts';
import { platformConfigurations, type PlatformConfig } from '#layers/BaseShared/shared/platformConstants';


const baseUrl = process.env.NUXT_BASE_URL
export const getPublicUrlForAsset = (assetUrl: string) => {

  return `${baseUrl}${assetUrl.replace('/api/v1/assets/serve/', '/assets/public/')}`
}
export const fetchedImageBase64 = async (url: string) => {
  // Request the image then save to base64 in the server
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Reduces an image from a given URL to a given maximum size (in KB)
 * by prioritizing compression over resizing to minimize quality loss.
 *
 * @param {string} url The URL of the image to reduce
 * @param {number} [maxSizeKB=976] //976kb is approximately 0.95MB
 *
 * @returns {Promise<{width: number, height: number, buffer: Buffer}>}
 * A promise that resolves with an object containing the reduced image's width, height, and buffer.
 */
export async function reduceImageBySize(url: string, maxSizeKB = 976) {
  try {
    // Fetch the image from the URL
    const fileContent = await fs.readFile(url)

    let imageBuffer = Buffer.from(fileContent);

    // Use sharp to get the metadata of the image
    const metadata = await sharp(imageBuffer).metadata();
    let width = metadata.width!;
    let height = metadata.height!;
    const format = metadata.format;

    // First attempt: Optimize/compress without resizing
    let optimizedBuffer = await optimizeImage(imageBuffer, format, maxSizeKB);
    if (optimizedBuffer.length / 1024 <= maxSizeKB) {
      return { width, height, buffer: optimizedBuffer };
    }

    // Second attempt: Progressive compression with quality reduction
    const qualityLevels = [90, 80, 70, 60, 50];
    for (const quality of qualityLevels) {
      optimizedBuffer = await compressImage(imageBuffer, format, quality);
      if (optimizedBuffer.length / 1024 <= maxSizeKB) {
        return { width, height, buffer: optimizedBuffer };
      }
    }

    // Last resort: Resize with minimal quality loss
    let currentBuffer = optimizedBuffer;
    while (currentBuffer.length / 1024 > maxSizeKB && width > 100 && height > 100) {
      width = Math.floor(width * 0.95); // Reduce dimensions by 5% for finer control
      height = Math.floor(height * 0.95);

      currentBuffer = await sharp(currentBuffer)
        .resize({ width, height, withoutEnlargement: true })
        .jpeg({ quality: 85 }) // Maintain reasonable quality even when resizing
        .toBuffer();

      if (width < 100 || height < 100) break; // Prevent overly small dimensions
    }

    return { width, height, buffer: currentBuffer };
  } catch (error) {
    log.error({ message: 'Error processing image', error: String(error) });
    throw error;
  }
}

/**
 * Optimizes image using format-specific lossless or minimal-loss techniques
 * Prioritizes JPEG and PNG for maximum social media compatibility
 */
export async function optimizeImage(buffer: Buffer, format: string | undefined, maxSizeKB: number): Promise<Buffer> {
  const sharpInstance = sharp(buffer);

  switch (format) {
    case 'jpeg':
    case 'jpg':
      return await sharpInstance
        .jpeg({ quality: 95, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'png':
      return await sharpInstance
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    case 'webp':
      // Convert WebP to JPEG for better compatibility
      return await sharpInstance
        .jpeg({ quality: 95, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'gif':
      // Convert GIF to PNG to preserve any transparency
      return await sharpInstance
        .png({ compressionLevel: 9 })
        .toBuffer();
    default:
      // For other formats, convert to JPEG (most compatible)
      return await sharpInstance
        .jpeg({ quality: 95, progressive: true, mozjpeg: true })
        .toBuffer();
  }
}

/**
 * Compresses image with specified quality level
 * Maintains format compatibility for social media platforms
 */
export async function compressImage(buffer: Buffer, format: string | undefined, quality: number): Promise<Buffer> {
  const sharpInstance = sharp(buffer);

  switch (format) {
    case 'jpeg':
    case 'jpg':
      return await sharpInstance
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'png':
      // PNG doesn't support quality, use higher compression instead
      return await sharpInstance
        .png({ compressionLevel: Math.min(9, Math.max(1, Math.floor(quality / 10))) })
        .toBuffer();
    case 'webp':
      // Convert WebP to JPEG for compression
      return await sharpInstance
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'gif':
      // Convert GIF to compressed PNG
      return await sharpInstance
        .png({ compressionLevel: Math.min(9, Math.max(1, Math.floor(quality / 10))) })
        .toBuffer();
    default:
      // Convert other formats to JPEG
      return await sharpInstance
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
  }
}

const platformProviderMap: Record<string, string> = {
  x: 'twitter',
  twitter: 'twitter',
  linkedin: 'linkedin',
  linkedin_page: 'linkedin-page',
  'linkedin-page': 'linkedin-page',
  facebook: 'facebook',
  instagram: 'instagram',
  'instagram-standalone': 'instagram',
  threads: 'threads',
  tiktok: 'tiktok',
  youtube: 'youtube',
  googlemybusiness: 'googlemybusiness',
  discord: 'discord',
  reddit: 'reddit',
  dribbble: 'dribbble',
}

/**
 * True when a `social_media_accounts.tokenExpiresAt` is in the past (or within
 * 5 minutes). Mirrors `socialMediaAccountService.isTokenExpired`, which reads
 * the Better Auth row's `accessTokenExpiresAt` — a different column.
 */
function isRowTokenExpired(expiresAt?: Date | number | null): boolean {
  if (!expiresAt) return false
  const ms = typeof expiresAt === 'number'
    ? (expiresAt < 1e12 ? expiresAt * 1000 : expiresAt)
    : new Date(expiresAt).getTime()
  return ms <= Date.now() + 5 * 60 * 1000
}

/**
 * Providers that authorize a page/channel's API calls but are not the provider
 * id stored on the platform post. YouTube channels and Google Business
 * locations refresh through `google`; a LinkedIn Page shares the LinkedIn
 * member token of the `linkedin` connection.
 */
const providerRefreshFallbacks: Record<string, string> = {
  youtube: 'google',
  'linkedin-page': 'linkedin',
}

/**
 * Persist a freshly minted token onto the social_media_accounts row.
 *
 * Facebook/Instagram rows hold PAGE tokens — mirroring the user token onto them
 * corrupts publishing (Meta "(#200) Unpublished posts…"), so those renew through
 * their own page-token exchange. Every other platform mirrors the user token.
 */
async function persistRefreshedToken(token: string, row: {
  rowId: string
  platform: string
  userId: string
  accountId: string
  accessToken?: string | null
  tokenExpiresAt?: Date | null
}): Promise<void> {
  if (!usesPageToken(row.platform)) {
    await socialMediaAccountService.updateAccount(row.rowId, { accessToken: token })
    return
  }
  if (!row.accountId) return
  const renewed = await renewRowToken({
    id: row.rowId,
    userId: row.userId,
    platform: row.platform,
    accountId: row.accountId,
    accessToken: row.accessToken,
    tokenExpiresAt: row.tokenExpiresAt,
  })
  if (renewed.error) {
    log.warn({ message: 'Page-token renewal skipped', platform: row.platform, error: renewed.error })
  }
}

/**
 * Resolve the Better Auth row that can mint a fresh token for a platform post:
 * the provider's own row first, then the fallback provider's row (see
 * providerRefreshFallbacks). `providerId` follows the row that was found, so
 * the request is attributed to the provider that actually issued the token.
 */
async function resolveRefreshProvider(userId: string, platform: string, providerId: string) {
  const own = await socialMediaAccountService.findBetterAuthAccountForRefresh(userId, providerId)
  if (own.success && own.data) return { account: own.data, providerId }

  const fallbackProvider = providerRefreshFallbacks[platform]
  if (!fallbackProvider) return { account: null, providerId }

  const fallback = await socialMediaAccountService.findBetterAuthAccountForRefresh(userId, fallbackProvider)
  return { account: fallback.success ? fallback.data : null, providerId: fallbackProvider }
}

/**
 * Refreshes social media tokens for the platforms that have expiring tokens,
 * using Better Auth's internal token refresh. Attempts refresh for all platforms
 * that have an associated Better Auth provider mapping.
 */
export const ScheduleRefreshSocialMediaTokens = async (fullPost: PostWithAllData, userId: string, headers: HeadersInit) => {
  const needsRefresh = fullPost.platformPosts.filter((platformPost) => {
    const providerId = platformProviderMap[platformPost.platformPostId || '']
    return !!providerId
  })

  if (needsRefresh.length === 0) return

  await Promise.allSettled(needsRefresh.map(async (platformPost) => {
    const platform = platformPost.platformPostId || ''
    const providerId = platformProviderMap[platform]
    const socialMediaAccount = await socialMediaAccountService.getActualAccountByAccountId(platformPost.socialAccountId);
    if (!providerId) return
    // Resolve the Better Auth row: its row id is the only identifier
    // /get-access-token accepts (provider account id / channel id never match).
    const { account, providerId: refreshProviderId } = await resolveRefreshProvider(userId, platform, providerId)

    log.info({ message: 'Single account found', providerId: refreshProviderId })
    if (!account) return


    // Refresh when EITHER the Better Auth row OR our social row looks expired.
    // The row's accessToken is what actually publishes; the Better Auth row can
    // report "not expired" — or have no expiry stored at all — while the row's
    // token is already dead. That mismatch surfaced as "token not valid" with no
    // refresh attempt, forcing a manual reconnect.
    const expired = socialMediaAccountService.isTokenExpired(account)
      || isRowTokenExpired(socialMediaAccount?.tokenExpiresAt)
    // SAFE: never log token material — ids + expiry only (account holds accessToken).
    log.info({ message: 'Token expired', accountId: account.id, providerId: refreshProviderId, expired })
    if (!expired) return

    const tokenData = await getAccessTokenHelper(headers, {
      providerId: refreshProviderId,
      userId,
      accountId: account.id,
    });

    // SAFE: never log token material — presence only.
    log.info({ message: 'Token data refreshed', hasAccessToken: !!tokenData?.accessToken })

    if (tokenData?.accessToken) {
      await persistRefreshedToken(tokenData.accessToken, {
        rowId: platformPost.socialAccountId,
        platform: platformPost.platformPostId || '',
        userId,
        accountId: socialMediaAccount?.accountId ?? '',
        accessToken: socialMediaAccount?.accessToken,
        tokenExpiresAt: socialMediaAccount?.tokenExpiresAt,
      })
    }
  }))
}

interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
}


export function validateContentForPlatform(platform: string, content: { text?: string; mediaUrls?: string[] }): ValidationResult {
  const config: PlatformConfig = platformConfigurations[platform] ?? platformConfigurations.default
  const errors: string[] = []
  const warnings: string[] = []

  if (!content.text?.trim()) {
    errors.push('Content text is required')
    return { isValid: false, warnings, errors }
  }

  const length = content.text.length
  if (length > config.maxPostLength) {
    errors.push(`Content exceeds ${config.maxPostLength} character limit for ${platform} (currently ${length})`)
  }

  if (config.maxPostLength <= 300 && length > config.maxPostLength * 0.85) {
    warnings.push(`Content is ${Math.round((length / config.maxPostLength) * 100)}% of ${config.maxPostLength} char limit`)
  }

  return { isValid: errors.length === 0, warnings, errors }
}
