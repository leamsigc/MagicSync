import { carouselService } from '#layers/BaseDB/server/services/carousel.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const result = await carouselService.listForUser(user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
