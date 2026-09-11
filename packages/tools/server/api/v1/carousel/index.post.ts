import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { createCarouselSchema } from '../../../utils/carousel-schema'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const body = await readValidatedBody(event, createCarouselSchema.parse)
  const result = await carouselService.upsert(user.id, body.id, {
    name: body.name,
    slides: body.slides,
    palette: body.palette,
    pattern: body.pattern,
    handle: body.handle,
    scene: body.scene,
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
