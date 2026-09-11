import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants'

export interface PlatformValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Per-platform content validation. Mirrors validatePlatformContent() in
 * packages/scheduler/server/api/v1/cli/post.post.ts — same limits, same
 * messages — so MCP and CLI agree on what each platform accepts.
 */
export function validatePlatformContent(
  platform: string,
  text: string,
  imageCount = 0,
  videoCount = 0
): PlatformValidation {
  const configs = platformConfigurations
  const config = configs[platform] ?? configs.default
  const errors: string[] = []
  const warnings: string[] = []

  if (!text?.trim()) {
    errors.push('Content text is required')
    return { isValid: false, errors, warnings }
  }

  if (text.length > config.maxPostLength) {
    errors.push(`Content exceeds ${config.maxPostLength} character limit for ${platform} (currently ${text.length})`)
  }

  if (imageCount > config.maxImages) {
    errors.push(`Too many images: ${imageCount} provided, max ${config.maxImages} for ${platform}`)
  }

  if (!config.supportsVideo && videoCount > 0) {
    errors.push(`${platform} does not support video`)
  }

  if (imageCount > 1 && !config.supportsCarousel) {
    errors.push(`${platform} does not support image carousels`)
  }

  if (config.maxPostLength <= 300 && text.length > config.maxPostLength * 0.85) {
    warnings.push(`Content is ${Math.round((text.length / config.maxPostLength) * 100)}% of ${config.maxPostLength} char limit`)
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validate content (plus per-platform overrides) for every target platform.
 * Throws a single aggregated Error on failure; returns per-platform results
 * (including warnings) for preview responses.
 */
export function assertValidForPlatforms(args: {
  platforms: string[]
  content: string
  platformContent?: Record<string, { content?: string }>
  imageCount?: number
  videoCount?: number
}): Record<string, PlatformValidation> {
  const results: Record<string, PlatformValidation> = {}
  for (const platform of args.platforms) {
    const text = args.platformContent?.[platform]?.content ?? args.content
    const validation = validatePlatformContent(platform, text, args.imageCount ?? 0, args.videoCount ?? 0)
    results[platform] = validation
    if (!validation.isValid) {
      throw new Error(`Validation failed for ${platform}: ${validation.errors.join('; ')}`)
    }
  }
  return results
}
