import { postService } from "#layers/BaseDB/server/services/post.service"

export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const session = await getUserSessionFromEvent(event)
    if (!session?.user?.id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    // Get query parameters
    const query = getQuery(event)
    let beforeDate: Date | undefined

    if (query.before) {
      beforeDate = new Date(query.before as string)
      if (isNaN(beforeDate.getTime())) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid before date format'
        })
      }
    }

    // Get scheduled posts
    const result = await postService.findScheduledPosts(beforeDate)

    if (!result) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch scheduled posts'
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
