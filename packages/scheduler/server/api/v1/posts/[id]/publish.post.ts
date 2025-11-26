/**
 * POST /api/v1/posts/[id]/publish - Publish a post immediately
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { postService } from "#layers/BaseDB/server/services/post.service"


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

    // Verify post exists and belongs to user
    const postResult = await postService.findById(postId, user.id)
    if (!postResult) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Failed to find post'
      })
    }

    const post = postResult.data!

    // Check if post can be published
    if (post.status === 'published') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Post is already published'
      })
    }

    // Update post status to scheduled for immediate publishing
    const updateResult = await postService.updateStatus(postId, user.id, 'pending')
    if (!updateResult) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update post status'
      })
    }

    // Schedule for immediate publishing
    const jobId = await QueueUtils.publishPostNow(postId)

    return {
      success: true,
      data: {
        postId,
        jobId,
        message: 'Post scheduled for immediate publishing'
      }
    }
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
