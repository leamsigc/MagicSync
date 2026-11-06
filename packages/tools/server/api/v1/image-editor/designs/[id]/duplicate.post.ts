import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

const duplicateSchema = z.object({
  title: z.string().max(200).optional(),
})

/** Duplicate a design (also used to instantiate a public template for editing). */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readValidatedBody(event, raw => duplicateSchema.safeParse(raw ?? {}).success ? duplicateSchema.parse(raw) : {})
  const result = await designService.duplicate(id, principal.userId, body.title)
  if (!result.success || !result.data) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to duplicate design' })
  }
  log.set({ sourceId: id, designId: result.data.id })
  return { id: result.data.id, title: result.data.title, document: result.data.envelope.doc }
})
