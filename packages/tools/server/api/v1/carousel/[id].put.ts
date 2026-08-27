import { z } from 'zod'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'

const carouselSlideSchema = z.object({
  id: z.string(),
  templateKey: z.string(),
  data: z.object({
    kicker: z.string().optional(),
    headline: z.string(),
    body: z.string().optional(),
    items: z.array(z.string()).optional(),
    quote: z.string().optional(),
    author: z.string().optional(),
    stat: z.string().optional(),
    statLabel: z.string().optional(),
    cta: z.string().optional(),
    footer: z.string().optional(),
    images: z.array(z.string()).optional(),
    borderRadius: z.number().optional(),
  }),
  pattern: z.string(),
  patternColor: z.string(),
  patternOpacity: z.number(),
  bgImage: z.object({
    url: z.string(),
    dim: z.number(),
    shadow: z.object({ x: z.number(), y: z.number(), blur: z.number(), opacity: z.number() }),
    transform: z.object({ x: z.number(), y: z.number(), scale: z.number() }).optional(),
  }).nullable(),
  customHtml: z.string(),
})

const updateCarouselSchema = z.object({
  name: z.string().max(120).optional(),
  slides: z.array(carouselSlideSchema).min(1).max(15).optional(),
  palette: z.object({
    bg: z.string(),
    text: z.string(),
    accent: z.string(),
    font: z.string().optional(),
  }).optional(),
  pattern: z.string().optional(),
  handle: z.string().max(120).optional(),
})

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
  }

  const result = await carouselService.upsert(user.id, carouselId, updatedData)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
