/**
 * GET /api/v1/cli/info
 *
 * Returns connected platforms, their rules/configs, and account details
 * for the authenticated API key.
 */
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const apiKeyContext = event.context.apiKey

  if (!apiKeyContext?.valid || !apiKeyContext.businessId) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or missing API key' })
  }

  const { businessId } = apiKeyContext

  // Fetch all connected accounts for this business
  const accounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)

  // Build platform list with rules and account info
  const connectedPlatforms = accounts.map((account) => {
    const platformKey = account.platform as keyof typeof platformConfigurations
    const config = platformConfigurations[platformKey] ?? platformConfigurations.default

    return {
      accountId: account.id,
      platform: account.platform,
      accountName: account.accountName,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      config: {
        maxPostLength: config.maxPostLength,
        maxImages: config.maxImages,
        supportsComments: config.supportsComments,
        supportsCarousel: config.supportsCarousel,
        supportsVideo: config.supportsVideo,
        maxVideoLengthSeconds: config.maxVideoLengthSeconds,
        supportsLinkPreviews: config.supportsLinkPreviews,
        supportsStories: config.supportsStories,
        supportsShorts: config.supportsShorts,
        supportedFormats: config.supportedFormats,
        mediaConstraints: config.mediaConstraints,
      },
    }
  })

  // Group by platform name (some platforms can have multiple accounts)
  const platformsGrouped: Record<string, {
    platform: string
    accounts: Array<{
      accountId: string
      accountName: string
      isActive: boolean
      tokenExpiresAt: string | null
      lastSyncAt: string | null
    }>
    config: typeof connectedPlatforms[0]['config']
  }> = {}

  for (const p of connectedPlatforms) {
    if (!platformsGrouped[p.platform]) {
      platformsGrouped[p.platform] = {
        platform: p.platform,
        accounts: [],
        config: {},
      }
    }
    platformsGrouped[p.platform as keyof typeof platformsGrouped]?.accounts.push({
      accountId: p.accountId,
      accountName: p.accountName,
      isActive: p.isActive,
      tokenExpiresAt: p.tokenExpiresAt,
      lastSyncAt: p.lastSyncAt,
    })
  }

  log.set({ businessId, platformCount: Object.keys(platformsGrouped).length, accountCount: accounts.length })

  return {
    success: true,
    data: {
      businessId,
      apiKeyName: apiKeyContext.name,
      platforms: Object.values(platformsGrouped),
      allPlatformRules: {},
    },
  }
})
