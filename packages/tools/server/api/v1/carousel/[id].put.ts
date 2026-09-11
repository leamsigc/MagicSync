import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { updateCarouselSchema } from '../../../utils/carousel-schema'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const carouselId = getRouterParam(event, 'id')
  if (!carouselId) {
    throw createError({ statusCode: 400, statusMessage: 'Carousel ID is required' })
  }

  const body = await readValidatedBody(event, updateCarouselSchema.parse)

  // Get existing carousel to merge updates
  const existing = await carouselService.getForUser(user.id, carouselId)
  if (existing.error || !existing.data) {
    throw createError({ statusCode: 404, statusMessage: existing.error ?? 'Carousel not found' })
  }

  const updatedData = {
    name: body.name ?? existing.data.name,
    slides: body.slides ?? existing.data.slides,
    palette: body.palette ?? existing.data.palette,
    pattern: body.pattern ?? existing.data.pattern,
    handle: body.handle ?? existing.data.handle,
    scene: body.scene ?? existing.data.scene,
  }

  const result = await carouselService.upsert(user.id, carouselId, updatedData)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
