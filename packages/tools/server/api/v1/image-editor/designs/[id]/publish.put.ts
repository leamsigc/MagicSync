import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

const publishSchema = z.object({ isPublic: z.boolean() })

/** Publish / unpublish a design into the public template library (owner-only). */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readValidatedBody(event, raw => publishSchema.parse(raw))
  const result = await designService.setPublic(id, principal.userId, body.isPublic)
  if (!result.success || !result.data) {
    throw createError({ statusCode: result.error === 'Design not found' ? 404 : 400, statusMessage: result.error ?? 'Failed to update design' })
  }
  log.set({ designId: id, isPublic: body.isPublic })
  return { id: result.data.id, isPublic: result.data.isPublic }
})
