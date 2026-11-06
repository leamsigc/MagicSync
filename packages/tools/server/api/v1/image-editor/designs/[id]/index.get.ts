import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

/** Fetch one design (owner or public). Public templates skip the auth check. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  let userId = ''
  try {
    userId = (await requireDesignAuth(event)).userId
  } catch {
    userId = ''
  }
  const result = await designService.findById(id, userId)
  if (!result.success || !result.data) {
    throw createError({ statusCode: 404, statusMessage: result.error ?? 'Design not found' })
  }
  return {
    id: result.data.id,
    title: result.data.title,
    isPublic: result.data.isPublic,
    ownerId: result.data.ownerId,
    document: result.data.envelope.doc,
    meta: result.data.envelope.meta,
    thumbnails: result.data.thumbnails,
    updatedAt: result.data.updatedAt,
  }
})
