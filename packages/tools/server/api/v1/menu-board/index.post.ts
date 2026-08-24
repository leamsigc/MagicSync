import { z } from 'zod'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'

const pageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  type: z.enum(['html', 'image']),
  content: z.string().max(500_000),
  isActive: z.boolean(),
  order: z.number().int().min(0),
})

const settingsSchema = z.object({
  transitionTime: z.number().int().min(1).max(3600).default(10),
  isLocked: z.boolean().default(false),
  unlockPin: z.string().max(32).default('0000'),
})

const upsertSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  pages: z.array(pageSchema).max(100),
  settings: settingsSchema,
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const body = await readBody(event)

    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      log.set({ validationError: true, issues: parsed.error.issues.length })
      throw createError({ statusCode: 400, statusMessage: 'Invalid menu board payload', data: parsed.error.flatten() })
    }

    const { id, ...data } = parsed.data
    const result = await menuBoardService.upsert(user.id, id, data)

    if (result.error || !result.data) {
      throw createError({ statusCode: 500, statusMessage: result.error ?? 'Failed to save menu board' })
    }

    return { board: result.data }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    log.error({ content: 'Save menu board failed', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
