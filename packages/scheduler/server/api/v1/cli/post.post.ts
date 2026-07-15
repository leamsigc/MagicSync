import { ScheduleRefreshSocialMediaTokens } from '#layers/BaseScheduler/server/utils/ScheduleUtils'
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { platformConfigurations } from '../../../../shared/platformConstants'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3000/api/v1/ai/generate'

interface ExternalPostBody {
  /** Default content for all platforms (can be overridden per-platform) */
  content: string
  /** Specific platforms to post to */
  platforms: string[]
  /** Media attachments */
  media?: {
    image?: string[]
    video?: string
  }
  /** ISO date string — if in the past or omitted, posts immediately */
  scheduledAt?: string
  /** Array of comment prompts for AI to generate platform-specific comments */
  commentPrompts?: string[]
  /** Per-platform content overrides */
  platformContent?: Record<string, {
    content?: string
    image?: string[]
    video?: string
    commentPrompt?: string
  }>
}

function getPlatformConfig(platform: string) {
  const key = platform as keyof typeof platformConfigurations
  return platformConfigurations[key] ?? platformConfigurations.default
}

function validatePlatformContent(platform: string, text: string, imageCount: number, videoCount: number): { isValid: boolean; errors: string[]; warnings: string[] } {
  const config = getPlatformConfig(platform)
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

async function downloadAndCreateAssets(userId: string, businessId: string, media: ExternalPostBody['media'], log?: ReturnType<typeof useLogger>) {
  const createdAssets: Array<{ id: string; url: string; type: string }> = []

  const userFolder = `/userFiles/${userId}`

  async function downloadAndStore(url: string, type: 'image' | 'video'): Promise<{ uniqueFilename: string; fileExtension: string; mimeType: string; fileSize: number } | null> {
    try {
      const response = await fetch(url)
      if (!response.ok) return null

      const buffer = await response.arrayBuffer()
      const base64Content = Buffer.from(buffer).toString('base64')

      const fileExtension = type === 'image' ? 'jpg' : 'mp4'
      const mimeType = type === 'image' ? 'image/jpeg' : 'video/mp4'
      const uniqueFilename = crypto.randomUUID()

      const serverFile: ServerFile = {
        name: `external_${uniqueFilename}.${fileExtension}`,
        content: `data:${mimeType};base64,${base64Content}`,
        size: String(buffer.byteLength),
        type: mimeType,
        lastModified: String(Date.now()),
      }

      await storeFileLocally(serverFile, uniqueFilename, userFolder)

      return { uniqueFilename, fileExtension, mimeType, fileSize: buffer.byteLength }
    } catch (error) {
      log?.error(`Failed to download ${type}:`, url, error)
      return null
    }
  }

  async function processMedia(url: string, type: 'image' | 'video'): Promise<void> {
    const stored = await downloadAndStore(url, type)
    if (!stored) return

    const fileUrl = `/api/v1/assets/serve/${stored.uniqueFilename}.${stored.fileExtension}`

    const result = await assetService.create(userId, {
      businessId,
      filename: stored.uniqueFilename,
      originalName: `external_${stored.uniqueFilename}.${stored.fileExtension}`,
      mimeType: stored.mimeType,
      size: stored.fileSize,
      url: fileUrl,
      metadata: {
        source: 'external',
        originalUrl: url,
        storedPath: `${userFolder}/${stored.uniqueFilename}.${stored.fileExtension}`,
      },
    })

    if (result.success && result.data) {
      createdAssets.push({ id: result.data.id, url: result.data.url, type })
    }
  }

  if (media?.image && media.image.length > 0) {
    for (const imageUrl of media.image) {
      await processMedia(imageUrl, 'image')
    }
  }

  if (media?.video) {
    await processMedia(media.video, 'video')
  }

  return createdAssets
}

async function generateComment(text: string, platform: string, commentPrompt?: string): Promise<string[]> {
  try {
    const response = await $fetch(AI_SERVICE_URL, {
      method: 'POST',
      body: {
        prompt: commentPrompt || `Generate a reply prompt/hook for a post on ${platform}. Return 3 short, engaging variations (1-2 sentences each) that could be used as conversation starters. Return ONLY the 3 options, separated by newlines.`,
        platform,
        type: 'comment',
      },
    })

    if (response && typeof response === 'object' && 'content' in response) {
      const content = (response as { content: string }).content
      return content.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3)
    }
  } catch { }

  return []
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const apiKeyContext = event.context.apiKey

  if (!apiKeyContext?.valid || !apiKeyContext.businessId) {
    log.set({ invalidApiKey: true })
    throw createError({ statusCode: 401, statusMessage: 'Invalid or missing API key' })
  }

  const body = await readBody(event) as ExternalPostBody
  const { businessId } = apiKeyContext

  if (!body.content || !body.platforms || !Array.isArray(body.platforms) || body.platforms.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'content and platforms are required' })
  }

  log.set({ businessId, platforms: body.platforms, hasScheduledAt: !!body.scheduledAt })

  const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(businessId)
  const connectedPlatforms = new Set(accounts.map(a => a.platform))
  // @ts-ignore
  const disconnectedPlatforms = body.platforms.filter(p => !connectedPlatforms.has(p))

  if (disconnectedPlatforms.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Platforms not connected: ${disconnectedPlatforms.join(', ')}. Connect them in your MagicSync dashboard first.`,
    })
  }

  const validationResults: Record<string, { isValid: boolean; errors: string[]; warnings: string[] }> = {}
  const imageCount = body.media?.image?.length ?? 0
  const videoCount = body.media?.video ? 1 : 0

  for (const platform of body.platforms) {
    const platformText = body.platformContent?.[platform]?.content ?? body.content
    const validation = validatePlatformContent(platform, platformText, imageCount, videoCount)
    validationResults[platform] = validation

    if (!validation.isValid) {
      throw createError({
        statusCode: 400,
        statusMessage: `Validation failed for ${platform}: ${validation.errors.join('; ')}`,
      })
    }
  }

  const relevantAccounts = accounts.filter(acc => body.platforms.includes(acc.platform))
  if (relevantAccounts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No connected accounts for requested platforms' })
  }
  const userId = relevantAccounts[0].userId

  const platformContent: Record<string, any> = {}
  for (const platform of body.platforms) {
    const override = body.platformContent?.[platform]
    platformContent[platform] = {
      content: override?.content ?? body.content,
      image: override?.image ?? body.media?.image,
      video: override?.video ?? body.media?.video,
    }
  }

  // Generate comments if prompts provided
  const comments: string[] = []
  if (body.commentPrompts && body.commentPrompts.length > 0) {
    for (const platform of body.platforms) {
      const commentPrompt = body.platformContent?.[platform]?.commentPrompt ?? body.commentPrompts[0]
      const platformComments = await generateComment(body.content, platform, commentPrompt)
      comments.push(...platformComments)
    }
  }

  const mediaAssets = await downloadAndCreateAssets(userId, businessId, body.media, log)

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date()
  const isImmediate = !body.scheduledAt || scheduledAt <= new Date()

  const primaryPlatform = body.platforms[0]
  const unifiedContent = platformContent[primaryPlatform]?.content ?? body.content

  const postData = {
    businessId,
    content: unifiedContent,
    mediaAssets: mediaAssets.map(a => a.id),
    targetPlatforms: relevantAccounts.map(acc => acc.id),
    scheduledAt,
    status: isImmediate ? 'published' : 'scheduled',
    comment: comments,
    platformContent,
  }

  const result = await postService.create(userId, postData)

  if (!result || result.error || !result.data) {
    log.set({ error: result?.error || 'Unknown error' })
    throw createError({ statusCode: 400, statusMessage: result.error || 'Failed to create post' })
  }

  log.set({ postId: result.data.id, status: isImmediate ? 'published' : 'scheduled' })

  if (isImmediate) {
    const fullPost = await postService.findByIdFull({ postId: result.data.id })
    if (fullPost) {
      await ScheduleRefreshSocialMediaTokens(fullPost, userId, getHeaders(event))
      const trigger = new AutoPostService()
      trigger.triggerSocialMediaPost(fullPost)
    }
  }

  const fullPost = await postService.findByIdFull({ postId: result.data.id })
  const platformStatuses = fullPost?.platformPosts?.map((pp: any) => ({
    platform: pp.platform,
    accountId: pp.socialAccountId,
    status: pp.status,
    errorMessage: pp.errorMessage || undefined,
    publishedAt: pp.publishedAt?.toISOString?.() || pp.publishedAt,
  })) || []

  return {
    success: true,
    postId: result.data.id,
    status: isImmediate ? 'published' : 'scheduled',
    scheduledAt: scheduledAt.toISOString(),
    contentUsed: platformContent,
    validationResults,
    platformStatuses,
  }
})
