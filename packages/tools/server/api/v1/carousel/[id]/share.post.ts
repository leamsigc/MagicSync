import { carouselService } from '#layers/BaseDB/server/services/carousel.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const carouselId = getRouterParam(event, 'id')
  if (!carouselId) {
    throw createError({ statusCode: 400, statusMessage: 'Carousel ID is required' })
  }

  const result = await carouselService.publish(user.id, carouselId)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
