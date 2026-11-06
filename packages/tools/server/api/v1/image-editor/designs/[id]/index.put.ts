import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  doc: z.unknown().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  isPublic: z.boolean().optional(),
  snapshot: z.boolean().optional(),
})

/** Update a design (owner-only). Snapshots a version whenever doc changes. */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readValidatedBody(event, raw => updateSchema.parse(raw))
  const result = await designService.update(id, principal.userId, body, { snapshot: body.snapshot ?? true })
  if (!result.success || !result.data) {
    throw createError({ statusCode: result.error === 'Design not found' ? 404 : 400, statusMessage: result.error ?? 'Failed to update design' })
  }
  return { id: result.data.id, title: result.data.title, isPublic: result.data.isPublic, updatedAt: result.data.updatedAt }
})
