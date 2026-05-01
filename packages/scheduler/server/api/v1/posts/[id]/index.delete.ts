import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { postService } from "#layers/BaseDB/server/services/post.service"


export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    // Get post ID from route params
    const postId = getRouterParam(event, 'id')
    if (!postId) {
      log.set({ validationError: true, message: 'Post ID is required' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Post ID is required'
      })
    }

    log.set({ postId, userId: user.id })
    // Delete post
    const result = await postService.delete(postId, user.id)

    if (!result) {
      log.set({ error: 'Failed to delete post' })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete post'
      })
    }

    log.set({ success: true })
    return {
      success: true,
      message: 'Post deleted successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'Delete post error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
