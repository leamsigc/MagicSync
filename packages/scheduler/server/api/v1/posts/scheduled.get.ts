import { postService } from "#layers/BaseDB/server/services/post.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const session = await getUserSessionFromEvent(event)
    if (!session?.user?.id) {
      log.set({ validationError: true, message: 'Unauthorized' })
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
        log.set({ validationError: true, message: 'Invalid before date format' })
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid before date format'
        })
      }
    }

    log.set({ userId: session.user.id, beforeDate: beforeDate?.toISOString() })
    // Get scheduled posts
    const result = await postService.findScheduledPosts(beforeDate)

    if (!result) {
      log.set({ error: 'Failed to fetch scheduled posts' })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch scheduled posts'
      })
    }

    log.set({ success: true, count: result.data?.length })
    return {
      success: true,
      data: result.data
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'Get scheduled posts error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
