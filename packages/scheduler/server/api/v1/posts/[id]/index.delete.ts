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

    // Delete post
    const result = await postService.delete(postId, user.id)

    if (!result) {

      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete post'
      })
    }

    return {
      success: true,
      message: 'Post deleted successfully'
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
