import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contentBoardService, type ContentItemUpdateData } from '#layers/BaseDB/server/services/content-board.service'
import { ContentItemFormatSchema, ContentItemStateSchema } from '#layers/BaseDB/db/schema'

export const MoveContentItemSchema = z.object({
  businessId: z.string().min(1),
  toState: ContentItemStateSchema.optional(),
  title: z.string().min(1).max(140).optional(),
  brief: z.string().max(8000).optional(),
  format: ContentItemFormatSchema.optional(),
  platforms: z.array(z.string().min(1).max(40)).max(12).optional(),
  priority: z.number().int().min(0).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})

type ContentItemPatch = z.infer<typeof MoveContentItemSchema>

function failureStatus(code?: string): number {
  return code === 'NOT_FOUND' ? 404 : 400
}

function pickPatch(body: ContentItemPatch): ContentItemUpdateData {
  const patch: ContentItemUpdateData = {}
  if (body.title !== undefined) patch.title = body.title
  if (body.brief !== undefined) patch.brief = body.brief
  if (body.format !== undefined) patch.format = body.format
  if (body.platforms !== undefined) patch.platforms = body.platforms
  if (body.priority !== undefined) patch.priority = body.priority
  if (body.scheduledAt !== undefined) patch.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
  return patch
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Item id is required' })
  const body = MoveContentItemSchema.parse(await readBody(event))

  if (body.toState) {
    const moved = await contentBoardService.move(user.id, body.businessId, id, body.toState, {
      actorKind: 'user',
      actorUserId: user.id,
    }, event)
    if (!moved.success) throw createError({ statusCode: failureStatus(moved.code), statusMessage: moved.error })
    return { item: moved.data.item, from: moved.data.from, to: moved.data.to }
  }
  const patch = pickPatch(body)
  if (Object.keys(patch).length === 0) throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  const updated = await contentBoardService.update(user.id, body.businessId, id, patch, {
    actorKind: 'user',
    actorUserId: user.id,
  }, event)
  if (!updated.success) throw createError({ statusCode: failureStatus(updated.code), statusMessage: updated.error })
  return { item: updated.data }
})
