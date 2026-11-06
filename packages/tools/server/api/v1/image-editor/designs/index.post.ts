import { z } from 'zod'
import { designService, type SaveDesignInput } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../utils/design-auth'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  doc: z.unknown(),
  meta: z.record(z.string(), z.unknown()).optional(),
  isPublic: z.boolean().optional(),
  thumbnails: z.array(z.object({
    name: z.string().min(1).max(120),
    url: z.string().min(1).max(250_000),
  })).max(5).optional(),
})

/** Create a design from a document envelope. */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  const body = await readValidatedBody(event, raw => createSchema.parse(raw))
  const input: SaveDesignInput = {
    title: body.title,
    doc: body.doc,
    meta: body.meta ?? {},
    isPublic: body.isPublic ?? false,
    thumbnails: body.thumbnails ?? [],
  }
  const result = await designService.create(principal.userId, input)
  if (!result.success || !result.data) throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to create design' })
  log.set({ designId: result.data.id })
  return { id: result.data.id, title: result.data.title, document: result.data.envelope.doc }
})
