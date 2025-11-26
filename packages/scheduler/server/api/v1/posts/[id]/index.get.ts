/**
 * GET /api/v1/posts/[id] - Get a specific post by ID
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { postService } from "#layers/BaseDB/server/services/post.service"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"


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

    // Get query parameters
    const query = getQuery(event)
    const includePlatforms = query.includePlatforms === 'true'

    // Get post
    const result = await postService.findById(postId, user.id, includePlatforms)

    if (!result) {
      throw createError({
        statusCode: 500,
        statusMessage: result || 'Failed to fetch post'
      })
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
      statusMessage: 'Internal server error'
    })
  }
})
