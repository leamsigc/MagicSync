/**
 * GET /api/v1/posts/[id] - Get a specific post by ID
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { postService } from "#layers/BaseDB/server/services/post.service"
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"


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
    // Get full post with platforms and assets — scoped to the owner
    const result = await postService.findByIdFull({ postId, userId: user.id })

    return {
      success: true,
      data: result
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    if (error?.message === 'Post not found') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Post not found'
      })
    }

    log.error({ content: 'Get post error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
