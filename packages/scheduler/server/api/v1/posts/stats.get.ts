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
    const businessId = query.businessId as string

    if (!businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    // Parse date range parameters
    const startDate = query.startDate as string
    const endDate = query.endDate as string

    // Get statistics using the service method
    const filters: any = {}
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate

    const result = await postService.getPostStats(businessId, session.user.id, filters)

    if (!result) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to calculate post statistics'
      })
    }

    const stats = result.data

    return {
      success: true,
      data: stats
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
