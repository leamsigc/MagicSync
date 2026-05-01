import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  log.set({ title: body.title })

  if (!body?.title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' })
  }

  const result = await chatService.createThread(user.id, { title: body.title })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
