/**
 * PUT /api/v1/posts/[id] - Update a specific post
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { postService, type UpdatePostData } from "#layers/BaseDB/server/services/post.service"
import dayjs from 'dayjs';


export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Get post ID from route params
    const postId = getRouterParam(event, 'id')
    if (!postId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Post ID is required'
      })
    }

    // Get request body
    const body = await readBody(event)

    // Prepare update data
    const updateData: UpdatePostData = {
      content: body.content || '',
      mediaAssets: body.mediaAssets || [],
      targetPlatforms: body.targetPlatforms || [],
      scheduledAt: dayjs(body.scheduledAt).toDate(),
      status: body.status || 'pending',
      comment: body.comment || [],
      postFormat: body.postFormat || 'post',
      platformContent: body.platformContent || {},
      platformSettings: body.platformSettings || {}
    }


    if (body.content !== undefined) {
      updateData.content = body.content
    }

    if (body.mediaAssets !== undefined) {
      updateData.mediaAssets = body.mediaAssets
    }
    if (body.targetPlatforms !== undefined) {
      if (!Array.isArray(body.targetPlatforms)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Target platforms must be an array'
        })
      }
      updateData.targetPlatforms = body.targetPlatforms
    }

    if (body.status !== undefined) {
      const validStatuses = ['pending', 'published', 'failed']
      if (!validStatuses.includes(body.status)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid status value'
        })
      }
      updateData.status = body.status
    }
    if (dayjs(body.scheduledAt).isBefore(dayjs())) {
      updateData.scheduledAt = dayjs().toDate()
    }

    // Update post
    const result = await postService.update(postId, user.id, updateData)


    if (!result || result.error) {
      throw createError({
        statusCode: 400,
        statusMessage: result.error || 'Failed to update post'
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
      await trigger.triggerSocialMediaPost(fullPost);
    }
    return result.data;
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
