import { ScheduleRefreshSocialMediaTokens } from '#layers/BaseScheduler/server/utils/ScheduleUtils';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { checkUserIsLogin, getAccessTokenHelper } from "#layers/BaseAuth/server/utils/AuthHelpers"
import type { PostCreateBase, PostWithAllData } from "#layers/BaseDB/db/schema"
import { postService } from "#layers/BaseDB/server/services/post.service"
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';

export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Get request body
    const body = await readBody(event)

    // Validate required fields
    if (!body.businessId || !body.content || !body.targetPlatforms || !Array.isArray(body.targetPlatforms) || body.targetPlatforms.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }

    // Prepare post data
    const postData: PostCreateBase = {
      businessId: body.businessId,
      content: body.content,
      mediaAssets: body.mediaAssets || [],
      targetPlatforms: body.targetPlatforms,
      scheduledAt: body.scheduledAt || new Date(),
      status: body.status || 'draft',
      comment: body.comment || [],
      platformContent: { ...body.platformContent, comment: body.comment || [] },
      platformSettings: body.platformSettings || {},
      postFormat: body.postFormat || 'post'
    }

    // Handle scheduled date
    const scheduledDate = new Date(body.scheduledAt)
    if (body.status === 'published' && !isNaN(scheduledDate.getTime())) {
      postData.scheduledAt = new Date()
    }

    // Create post
    const result = await postService.create(user.id, postData)

    if (!result || result.error) {
      throw createError({
        statusCode: 400,
        statusMessage: result.error || 'Failed to create post'
      })
    }

    if (body.status === 'published' && result.data) {
      const fullPost = await postService.findByIdFull({ postId: result.data.id });
      if (!fullPost || !fullPost) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Failed to find post'
        })
      }
      // Schedule post
      const trigger = new AutoPostService()
      // Refresh social media tokens if necessary
      await ScheduleRefreshSocialMediaTokens(fullPost, user.id, getHeaders(event));

      trigger.triggerSocialMediaPost(fullPost);
    }


    return {
      success: true,
      data: result.data
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error} `
    })
  }
})
