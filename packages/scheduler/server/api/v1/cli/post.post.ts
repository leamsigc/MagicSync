import { ScheduleRefreshSocialMediaTokens } from '#layers/BaseScheduler/server/utils/ScheduleUtils';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { postService } from '#layers/BaseDB/server/services/post.service';
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { validateContentForPlatform } from '#layers/BaseScheduler/server/utils/ScheduleUtils';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3000/api/v1/ai/generate'

interface ExternalPostBody {
  content: string;
  platforms: string[];
  media?: {
    image?: string[];
    video?: string;
  };
  scheduledAt?: string;
  comments?: string[];
}

async function downloadAndCreateAssets(userId: string, businessId: string, media: ExternalPostBody['media']) {
  const createdAssets: Array<{ id: string; url: string; type: string }> = []
  
  if (media?.image && media.image.length > 0) {
    for (const imageUrl of media.image) {
      try {
        const response = await fetch(imageUrl)
        if (!response.ok) continue
        
        const buffer = await response.arrayBuffer()
        const blob = new Blob([buffer])
        const filename = `external_${crypto.randomUUID()}.jpg`
        
        const result = await assetService.create(userId, {
          businessId,
          filename,
          originalName: filename,
          mimeType: blob.type || 'image/jpeg',
          size: blob.size,
          url: imageUrl,
          metadata: { source: 'external', originalUrl: imageUrl }
        })
        
        if (result.success && result.data) {
          createdAssets.push({
            id: result.data.id,
            url: result.data.url,
            type: 'image'
          })
        }
      } catch (error) {
        console.error('Failed to download image:', imageUrl, error)
      }
    }
  }
  
  if (media?.video) {
    try {
      const response = await fetch(media.video)
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`)
      }
      
      const buffer = await response.arrayBuffer()
      const blob = new Blob([buffer])
      const filename = `external_${crypto.randomUUID()}.mp4`
      
      const result = await assetService.create(userId, {
        businessId,
        filename,
        originalName: filename,
        mimeType: blob.type || 'video/mp4',
        size: blob.size,
        url: media.video,
        metadata: { source: 'external', originalUrl: media.video }
      })
      
      if (result.success && result.data) {
        createdAssets.push({
          id: result.data.id,
          url: result.data.url,
          type: 'video'
        })
      }
    } catch (error) {
      console.error('Failed to download video:', media.video, error)
    }
  }
  
  return createdAssets
}

async function formatContentWithAI(content: string, platform: string): Promise<string> {
  try {
    const response = await $fetch(AI_SERVICE_URL, {
      method: 'POST',
      body: {
        prompt: `Format the following content to be valid for ${platform}. Keep the core message but adjust length and format as needed. Return only the formatted content, nothing else:\n\n${content}`,
        platform
      }
    })
    
    if (response && typeof response === 'object' && 'content' in response) {
      return (response as { content: string }).content
    }
  } catch (error) {
    console.error('AI formatting failed:', error)
  }
  
  return content
}

export default defineEventHandler(async (event) => {
  const apiKeyContext = event.context.apiKey
  
  if (!apiKeyContext?.valid || !apiKeyContext.businessId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or missing API key'
    })
  }

  const body = await readBody(event) as ExternalPostBody
  
  if (!body.content || !body.platforms || !Array.isArray(body.platforms) || body.platforms.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'content and platforms are required'
    })
  }

  const { businessId, connectedPlatforms } = apiKeyContext
  
  const businessResult = await businessProfileService.findById(businessId, '')

  if (!businessResult.success || !businessResult.data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Business not found'
    })
  }

  const connectedAccounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
  const accountsForPlatforms = connectedAccounts.filter(acc => 
    body.platforms.includes(acc.platform)
  )

  if (accountsForPlatforms.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `No connected accounts found for platforms: ${body.platforms.join(', ')}. Please connect these platforms in your business settings first.`
    })
  }

  const validationResults: Record<string, { isValid: boolean; errors?: string[] }> = {}
  let formattedContent = body.content
  
  for (const platform of body.platforms) {
    const validation = validateContentForPlatform(platform, { text: body.content, mediaUrls: [] })
    validationResults[platform] = { isValid: validation.isValid, errors: validation.errors }
    
    if (!validation.isValid && validation.errors && validation.errors.length > 0) {
      formattedContent = await formatContentWithAI(body.content, platform)
      const revalidation = validateContentForPlatform(platform, { text: formattedContent, mediaUrls: [] })
      validationResults[platform] = { isValid: revalidation.isValid, errors: revalidation.errors }
      
      if (!revalidation.isValid) {
        throw createError({
          statusCode: 400,
          statusMessage: `Content validation failed for ${platform}: ${validation.errors.join(', ')}. Please adjust your content to meet ${platform}'s requirements.`
        })
      }
    }
  }

  const userId = accountsForPlatforms[0].userId
  
  const mediaAssets = await downloadAndCreateAssets(userId, businessId, body.media)

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date()
  const isImmediate = !body.scheduledAt || scheduledAt <= new Date()

  const postData = {
    businessId,
    content: formattedContent,
    mediaAssets: mediaAssets.map(a => a.id),
    targetPlatforms: body.platforms,
    scheduledAt,
    status: isImmediate ? 'published' : 'scheduled',
    comment: body.comments || [],
    platformContent: body.comments?.length ? { comment: body.comments } : {}
  }

  const result = await postService.create(userId, postData)

  if (!result || result.error || !result.data) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error || 'Failed to create post'
    })
  }

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
    platform: pp.platformPostId || pp.socialAccountId,
    status: pp.status,
    errorMessage: pp.errorMessage || undefined,
    publishedAt: pp.publishedAt?.toISOString?.() || pp.publishedAt
  })) || []

  return {
    success: true,
    postId: result.data.id,
    status: isImmediate ? 'published' : 'scheduled',
    scheduledAt: scheduledAt.toISOString(),
    content: formattedContent,
    platforms: body.platforms,
    validationResults,
    platformStatuses
  }
})
