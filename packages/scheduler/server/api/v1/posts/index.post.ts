import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import type { PostCreateBase, PostWithAllData } from "#layers/BaseDB/db/schema"
import { postService } from "#layers/BaseDB/server/services/post.service"

export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Get request body
    const body = await readBody(event)

    // Validate required fields
    if (!body.businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    if (!body.content) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Post content is required'
      })
    }

    if (!body.targetPlatforms || !Array.isArray(body.targetPlatforms) || body.targetPlatforms.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one target platform is required'
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
      comment: body.comment || []

    }

    // Handle scheduled date
    if (body.scheduledAt) {
      const scheduledDate = new Date(body.scheduledAt)
      if (isNaN(scheduledDate.getTime())) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid scheduled date format'
        })
      }
      postData.scheduledAt = scheduledDate
    }

    // Create post
    const result = await postService.create(user.id, postData)

    if (!result) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to create post'
      })
    }


    // If the status is scheduled
    console.log("Status", body.status);

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
