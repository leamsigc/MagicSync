/**
 * GET /api/v1/posts - List posts with filtering and pagination
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

    // Get query parameters
    const query = getQuery(event)
    const businessId = query.businessId as string

    if (!businessId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID is required'
      })
    }

    // Parse pagination parameters
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10

    // Parse filter parameters
    const filters: any = {}
    if (query.status) {
      filters.status = query.status as string
    }
    if (query.startDate) {
      filters.startDate = query.startDate as string
    }
    if (query.endDate) {
      filters.endDate = query.endDate as string
    }
    if (query.dateType) {
      filters.dateType = query.dateType as string
    }
    if (query.postFormat) {
      filters.postFormat = query.postFormat as string
    }
    if (query.platforms) {
      filters.platforms = (query.platforms as string).split(',')
    }

    // Get posts
    const result = await postService.findByBusinessId(businessId, user.id, {
      pagination: { page, limit },
      filters
    })

    return result;
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
