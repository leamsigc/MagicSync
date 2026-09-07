import { defineEventHandler, createError } from 'h3'
import { postService } from '#layers/BaseDB/server/services/post.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = event.context.params?.id

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Post ID required' })

  const found = await postService.findById(id, user.id)
  if (!found || !found.data) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  }

  let config: Record<string, unknown> = {}
  if (found.data.autoRepost) {
    try { config = JSON.parse(found.data.autoRepost) } catch { config = {} }
  }

  return { success: true, config }
})
