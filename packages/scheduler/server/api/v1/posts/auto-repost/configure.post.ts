import { defineEventHandler, readValidatedBody, createError } from 'h3'
import { z } from 'zod'
import { postBatchService } from '#layers/BaseDB/server/services/post-batch.service'
import { postService } from '#layers/BaseDB/server/services/post.service'

const configureSchema = z.object({
  postId: z.string().min(1),
  enabled: z.boolean(),
  intervalHours: z.number().int().min(1).max(168).optional(),
  maxReposts: z.number().int().min(1).max(20).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readValidatedBody(event, configureSchema.parse)
  const { postId, enabled, intervalHours, maxReposts } = body

  const found = await postService.findById(postId, user.id)
  if (!found || !found.data) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  }

  let config: Record<string, unknown> = {}
  if (found.data.autoRepost) {
    try { config = JSON.parse(found.data.autoRepost) } catch { config = {} }
  }

  if (enabled) {
    const hours = intervalHours || (config as any).intervalHours || 24
    const max = maxReposts || (config as any).maxReposts || 3
    config = {
      enabled: true,
      intervalHours: hours,
      maxReposts: max,
      currentCount: (config as any).currentCount || 0,
      nextRepostAt: (config as any).nextRepostAt || new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
    }
  } else {
    config = { ...config, enabled: false }
  }

  const updated = await postBatchService.updateAutoRepostConfig(postId, config)
  if (updated.error) {
    throw createError({ statusCode: 500, statusMessage: updated.error })
  }

  return { success: true, config }
})
