/**
 * POST /api/v1/cli/validate
 *
 * Validates content against platform rules before posting.
 * Optionally pass platform-specific content overrides.
 */
import { platformConfigurations } from '../../../../shared/platformConstants'
import type { PlatformConfig } from '../../../../shared/platformConstants'

interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
}

interface PlatformContent {
  text?: string
  imageCount?: number
  videoCount?: number
  imageUrls?: string[]
  videoUrl?: string
}

function getPlatformConfig(platform: string): PlatformConfig {
  const key = platform as keyof typeof platformConfigurations
  return platformConfigurations[key] ?? platformConfigurations.default
}

function validateText(text: string | undefined, config: PlatformConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!text || text.trim().length === 0) {
    errors.push('Content text is required')
    return { isValid: false, warnings, errors }
  }

  const length = text.length
  if (length > config.maxPostLength) {
    errors.push(`Content exceeds ${config.maxPostLength} character limit (currently ${length})`)
  }

  // Platform-specific warnings
  if (config.maxPostLength <= 300 && length > config.maxPostLength * 0.9) {
    warnings.push(`Content is ${Math.round((length / config.maxPostLength) * 100)}% of ${config.maxPostLength} char limit — consider shortening`)
  }

  return { isValid: errors.length === 0, warnings, errors }
}

function validateMedia(content: PlatformContent, config: PlatformConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config.supportsVideo && (content.videoCount ?? 0) > 0) {
    errors.push(`${config.name} does not support video`)
  }

  if (!config.supportsCarousel && (content.imageCount ?? 0) > 1) {
    errors.push(`${config.name} does not support image carousels (only ${config.maxImages} image(s) allowed)`)
  }

  if ((content.imageCount ?? 0) > config.maxImages) {
    errors.push(`Too many images: ${content.imageCount} provided, max ${config.maxImages} for this platform`)
  }

  return { isValid: errors.length === 0, warnings, errors }
}

function validatePlatform(platform: string, content: PlatformContent): ValidationResult {
  const config = getPlatformConfig(platform)
  const allResults: ValidationResult[] = []

  allResults.push(validateText(content.text, config))
  allResults.push(validateMedia(content, config))

  const errors = allResults.flatMap(r => r.errors)
  const warnings = allResults.flatMap(r => r.warnings)

  return { isValid: errors.length === 0, warnings, errors }
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const apiKeyContext = event.context.apiKey

  if (!apiKeyContext?.valid || !apiKeyContext.businessId) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or missing API key' })
  }

  const body = await readBody(event)
  const { businessId } = apiKeyContext

  if (!body.content && !body.platformContent) {
    throw createError({ statusCode: 400, statusMessage: 'content or platformContent is required' })
  }

  const platforms: string[] = body.platforms
  const defaultContent: PlatformContent = {
    text: body.content,
    imageCount: body.media?.image?.length ?? 0,
    videoCount: body.media?.video ? 1 : 0,
    imageUrls: body.media?.image,
    videoUrl: body.media?.video,
  }

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    const result = validatePlatform('default', defaultContent)
    return {
      success: true,
      data: {
        isValid: result.isValid,
        warnings: result.warnings,
        errors: result.errors,
      },
    }
  }

  // Get connected accounts to verify access
  const accounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
  const connectedPlatforms = new Set(accounts.map((a: any) => a.platform))
  const disconnectedPlatforms = platforms.filter(p => !connectedPlatforms.has(p))

  if (disconnectedPlatforms.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Platforms not connected: ${disconnectedPlatforms.join(', ')}. Connect them in your MagicSync dashboard first.`,
    })
  }

  const results: Record<string, {
    isValid: boolean
    warnings: string[]
    errors: string[]
    config: PlatformConfig
  }> = {}

  for (const platform of platforms) {
    const platformSpecific = body.platformContent?.[platform]
    const effectiveContent: PlatformContent = platformSpecific
      ? { ...defaultContent, ...platformSpecific }
      : defaultContent

    const validation = validatePlatform(platform, effectiveContent)
    results[platform] = {
      ...validation,
      config: getPlatformConfig(platform),
    }
  }

  const allValid = Object.values(results).every(r => r.isValid)

  log.set({ businessId, platforms, isValid: allValid })

  return {
    success: true,
    data: {
      isValid: allValid,
      validations: results,
      summary: {
        total: platforms.length,
        valid: Object.values(results).filter(r => r.isValid).length,
        invalid: Object.values(results).filter(r => !r.isValid).length,
      },
    },
  }
})
